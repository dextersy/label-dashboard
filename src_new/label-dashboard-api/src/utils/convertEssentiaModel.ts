/**
 * Converts Essentia TF1 frozen-graph (.pb) models to TF.js GraphModel format
 * (model.json + group1-shard1of1.bin) so they can be loaded with tf.loadGraphModel().
 *
 * No Python required — uses protobufjs to parse the GraphDef protobuf directly.
 *
 * Usage:
 *   const outDir = await convertFrozenGraph(pbBuffer, outputDir);
 *   const model = await tf.loadGraphModel(tf.io.fileSystem(outDir + '/model.json'));
 */

import * as fs from 'fs';
import * as path from 'path';
import * as protobuf from 'protobufjs';

// ── Minimal TF proto schema (subset needed for frozen graph conversion) ────────

const TF_PROTO = `
syntax = "proto3";
package tensorflow;

enum DataType {
  DT_INVALID = 0; DT_FLOAT = 1; DT_DOUBLE = 2; DT_INT32 = 3; DT_UINT8 = 4;
  DT_INT16 = 5; DT_INT8 = 6; DT_STRING = 7; DT_COMPLEX64 = 8; DT_INT64 = 9;
  DT_BOOL = 10; DT_QINT8 = 11; DT_QUINT8 = 12; DT_QINT32 = 13;
  DT_BFLOAT16 = 14; DT_UINT16 = 17; DT_HALF = 19; DT_UINT32 = 22; DT_UINT64 = 23;
}

message TensorShapeProto {
  message Dim { int64 size = 1; string name = 2; }
  repeated Dim dim = 2;
  bool unknown_rank = 3;
}

message TensorProto {
  DataType dtype = 1;
  TensorShapeProto tensor_shape = 2;
  int32 version_number = 3;
  bytes tensor_content = 4;
  repeated float float_val = 5;
  repeated double double_val = 6;
  repeated int32 int_val = 7;
  repeated bytes string_val = 8;
  repeated int64 int64_val = 10;
  repeated bool bool_val = 11;
  repeated int32 half_val = 13;
  repeated int32 uint32_val = 16;
  repeated int64 uint64_val = 17;
}

message AttrValue {
  message ListValue {
    repeated bytes s = 2;
    repeated int64 i = 3;
    repeated float f = 4;
    repeated bool b = 5;
    repeated DataType type = 6;
    repeated TensorShapeProto shape = 7;
    repeated TensorProto tensor = 8;
  }
  bytes s = 2;
  int64 i = 3;
  float f = 4;
  bool b = 5;
  DataType type = 6;
  TensorShapeProto shape = 7;
  TensorProto tensor = 8;
  ListValue list = 1;
  string placeholder = 9;
}

message NodeDef {
  string name = 1;
  string op = 2;
  repeated string input = 3;
  string device = 4;
  map<string, AttrValue> attr = 5;
}

message VersionDef {
  int32 producer = 1;
  int32 min_consumer = 2;
}

message GraphDef {
  repeated NodeDef node = 1;
  VersionDef versions = 4;
}
`;

// ── Data type mappings ────────────────────────────────────────────────────────

const DT_TO_STRING: Record<number, string> = {
  0: 'DT_INVALID', 1: 'DT_FLOAT', 2: 'DT_DOUBLE', 3: 'DT_INT32',
  4: 'DT_UINT8',   5: 'DT_INT16', 6: 'DT_INT8',   7: 'DT_STRING',
  8: 'DT_COMPLEX64', 9: 'DT_INT64', 10: 'DT_BOOL', 14: 'DT_BFLOAT16',
  17: 'DT_UINT16', 19: 'DT_HALF', 22: 'DT_UINT32', 23: 'DT_UINT64',
};

const DT_TO_TFJS_DTYPE: Record<number, string> = {
  1: 'float32', 2: 'float64', 3: 'int32', 4: 'int32',
  9: 'int32',  10: 'bool',   19: 'float32',
};

const DT_BYTES: Record<number, number> = {
  1: 4, 2: 8, 3: 4, 4: 1, 9: 8, 10: 1, 19: 2,
};

// ── Protobuf helpers ──────────────────────────────────────────────────────────

function longToNumber(v: any): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && 'low' in v) {
    // protobufjs Long
    return v.low + v.high * 0x100000000;
  }
  return Number(v);
}

function convertShape(shape: any): { dim: Array<{ size: string }>; unknownRank?: boolean } {
  if (!shape) return { dim: [] };
  return {
    dim: (shape.dim || []).map((d: any) => ({ size: String(longToNumber(d.size)) })),
    ...(shape.unknownRank ? { unknownRank: true } : {}),
  };
}

// ── Tensor data extraction ────────────────────────────────────────────────────

function extractTensorBytes(tp: any): Buffer | null {
  const dtype: number = tp.dtype ?? 1;

  // Prefer tensor_content (raw packed bytes) for large tensors
  if (tp.tensorContent && tp.tensorContent.length > 0) {
    return Buffer.from(tp.tensorContent);
  }

  // Fall back to individual value fields
  if (dtype === 1 && tp.floatVal && tp.floatVal.length > 0) {
    const buf = Buffer.allocUnsafe(tp.floatVal.length * 4);
    for (let i = 0; i < tp.floatVal.length; i++) buf.writeFloatLE(tp.floatVal[i], i * 4);
    return buf;
  }
  if (dtype === 3 && tp.intVal && tp.intVal.length > 0) {
    const buf = Buffer.allocUnsafe(tp.intVal.length * 4);
    for (let i = 0; i < tp.intVal.length; i++) buf.writeInt32LE(longToNumber(tp.intVal[i]), i * 4);
    return buf;
  }
  if (dtype === 9 && tp.int64Val && tp.int64Val.length > 0) {
    const buf = Buffer.allocUnsafe(tp.int64Val.length * 8);
    for (let i = 0; i < tp.int64Val.length; i++) {
      buf.writeBigInt64LE(BigInt(longToNumber(tp.int64Val[i])), i * 8);
    }
    return buf;
  }
  if (dtype === 10 && tp.boolVal && tp.boolVal.length > 0) {
    return Buffer.from(tp.boolVal.map((b: boolean) => (b ? 1 : 0)));
  }
  if (dtype === 19 && tp.halfVal && tp.halfVal.length > 0) {
    const buf = Buffer.allocUnsafe(tp.halfVal.length * 2);
    for (let i = 0; i < tp.halfVal.length; i++) buf.writeUInt16LE(tp.halfVal[i] & 0xffff, i * 2);
    return buf;
  }

  // Scalar: synthesise from shape (all-zeros tensor)
  const shape = tp.tensorShape;
  if (shape) {
    const nElem = (shape.dim || []).reduce((acc: number, d: any) => acc * longToNumber(d.size), 1);
    const bytesPerElem = DT_BYTES[dtype] ?? 4;
    return Buffer.alloc(nElem * bytesPerElem, 0);
  }

  return null;
}

function tensorShape(tp: any): number[] {
  return ((tp.tensorShape?.dim) || []).map((d: any) => longToNumber(d.size));
}

// ── Attr value conversion ─────────────────────────────────────────────────────

function convertAttrValue(av: any): any {
  if (av == null) return {};

  // AttrValue is a "fake oneof" in proto3 — check each field
  if (av.tensor != null) {
    const tp = av.tensor;
    return {
      tensor: {
        dtype: DT_TO_STRING[tp.dtype ?? 1] ?? 'DT_FLOAT',
        tensorShape: convertShape(tp.tensorShape),
      },
    };
  }
  if (av.f != null && av.f !== 0) return { f: av.f };
  if (av.i != null) {
    const n = longToNumber(av.i);
    if (n !== 0) return { i: n };
  }
  if (av.b != null && av.b) return { b: av.b };
  if (av.type != null && av.type !== 0) return { type: DT_TO_STRING[av.type] ?? av.type };
  if (av.shape != null) return { shape: convertShape(av.shape) };
  if (av.s != null && av.s.length > 0) {
    return { s: Buffer.isBuffer(av.s) ? av.s.toString('base64') : av.s };
  }
  if (av.list != null) {
    const l = av.list;
    const result: any = {};
    if (l.f?.length)    result.f = l.f;
    if (l.i?.length)    result.i = l.i.map(longToNumber);
    if (l.b?.length)    result.b = l.b;
    if (l.type?.length) result.type = l.type.map((t: number) => DT_TO_STRING[t] ?? t);
    if (l.shape?.length) result.shape = l.shape.map(convertShape);
    return { list: result };
  }
  return {};
}

// ── Main conversion ───────────────────────────────────────────────────────────

/**
 * Convert a TF1 frozen graph (.pb) buffer to TF.js GraphModel format files.
 * Writes model.json and group1-shard1of1.bin into outputDir.
 * Returns outputDir.
 */
export async function convertFrozenGraph(pbBuffer: Buffer, outputDir: string): Promise<string> {
  fs.mkdirSync(outputDir, { recursive: true });

  // Parse proto schema and decode frozen graph
  const root = protobuf.parse(TF_PROTO).root;
  const GraphDef = root.lookupType('tensorflow.GraphDef');
  const graph = GraphDef.toObject(GraphDef.decode(pbBuffer), {
    longs: Number,
    defaults: false,
    arrays: true,
    objects: true,
    oneofs: false,
  }) as any;

  const weightSpecs: any[] = [];
  const weightBuffers: Buffer[] = [];
  const nodes: any[] = [];
  let byteOffset = 0;

  for (const node of (graph.node || [])) {
    const attrs = node.attr || {};

    if (node.op === 'Const') {
      const tp = attrs['value']?.tensor;
      const dtype = tp?.dtype ?? 1;
      const shape = tensorShape(tp);
      const data = tp ? extractTensorBytes(tp) : null;

      if (data) {
        // Pad to 4-byte alignment
        const padded = data.length % 4 === 0 ? data : Buffer.concat([data, Buffer.alloc(4 - (data.length % 4))]);
        weightBuffers.push(padded);
        weightSpecs.push({
          name: node.name,
          shape,
          dtype: DT_TO_TFJS_DTYPE[dtype] ?? 'float32',
        });
        byteOffset += padded.length;
      }

      // Keep Const node in topology but without embedded tensor data
      nodes.push({
        name: node.name,
        op: 'Const',
        ...(node.input?.length ? { input: node.input } : {}),
        attr: {
          dtype: { type: DT_TO_STRING[dtype] ?? 'DT_FLOAT' },
          value: {
            tensor: {
              dtype: DT_TO_STRING[dtype] ?? 'DT_FLOAT',
              tensorShape: convertShape(tp?.tensorShape),
            },
          },
        },
      });
    } else {
      // Convert non-Const node
      const convertedAttrs: Record<string, any> = {};
      for (const [k, v] of Object.entries(attrs)) {
        convertedAttrs[k] = convertAttrValue(v);
      }
      nodes.push({
        name: node.name,
        op: node.op,
        ...(node.input?.length ? { input: node.input } : {}),
        ...(node.device ? { device: node.device } : {}),
        ...(Object.keys(convertedAttrs).length ? { attr: convertedAttrs } : {}),
      });
    }
  }

  // Write binary weight shard
  const weightData = Buffer.concat(weightBuffers);
  fs.writeFileSync(path.join(outputDir, 'group1-shard1of1.bin'), weightData);

  // Write model.json
  const modelJson = {
    format: 'graph-model',
    generatedBy: '1.15.0',
    convertedBy: 'essentia-node-converter',
    modelTopology: {
      node: nodes,
      versions: { producer: longToNumber(graph.versions?.producer ?? 27) },
    },
    weightsManifest: [
      {
        paths: ['group1-shard1of1.bin'],
        weights: weightSpecs,
      },
    ],
  };
  fs.writeFileSync(path.join(outputDir, 'model.json'), JSON.stringify(modelJson));

  return outputDir;
}
