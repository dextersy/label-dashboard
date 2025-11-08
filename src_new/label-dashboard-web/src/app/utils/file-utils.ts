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

  // RFC 5987: Try filename*=UTF-8''... first (takes precedence for international characters)
  const rfc5987Regex = /filename\*=UTF-8''([^;\n]+)/i;
  const rfc5987Match = rfc5987Regex.exec(contentDisposition);

  if (rfc5987Match && rfc5987Match[1]) {
    try {
      return decodeURIComponent(rfc5987Match[1]);
    } catch (e) {
      console.error('Error decoding RFC 5987 filename:', e);
      // Fall through to try regular filename
    }
  }

  // Fallback: Try regular filename="..." or filename=...
  const filenameRegex = /filename=["']?([^"';\n]+)["']?/i;
  const filenameMatch = filenameRegex.exec(contentDisposition);

  if (filenameMatch && filenameMatch[1]) {
    return filenameMatch[1].trim();
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
