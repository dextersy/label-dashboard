import { HttpResponse } from '@angular/common/http';

/**
 * Utility functions for file operations
 */

/**
 * Extracts the filename from a Content-Disposition header
 *
 * @param contentDisposition The Content-Disposition header value
 * @returns The extracted filename or a default filename
 */
export function extractFilenameFromContentDisposition(contentDisposition: string | null): string {
  if (!contentDisposition) {
    return 'download.zip';
  }

  // Try to match filename="..." or filename*=UTF-8''...
  const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
  const matches = filenameRegex.exec(contentDisposition);

  if (matches && matches[1]) {
    let filename = matches[1].replace(/['"]/g, '');
    // Handle RFC 5987 encoded filenames (filename*=UTF-8''...)
    if (filename.includes("UTF-8''")) {
      filename = decodeURIComponent(filename.split("UTF-8''")[1]);
    }
    return filename;
  }

  return 'download.zip';
}

/**
 * Triggers a download of a blob with the specified filename
 *
 * @param blob The blob to download
 * @param fileName The filename to use for the download
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Delay URL revocation to ensure download is initiated in all browsers
  setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Downloads a file from an HTTP response, extracting the filename from headers
 *
 * @param response The HTTP response containing the blob and headers
 */
export function downloadFromResponse(response: HttpResponse<Blob>): void {
  if (!response.body) {
    console.error('No response body to download');
    return;
  }

  const contentDisposition = response.headers.get('Content-Disposition');
  const filename = extractFilenameFromContentDisposition(contentDisposition);
  downloadBlob(response.body, filename);
}
