import { decryptBlob } from './crypto';

export const PDF_MIME = 'application/pdf';

export function isPdfFile(record) {
  return (record?.mime || record?.type || '') === PDF_MIME;
}

export async function openPdfRecord(record) {
  const opened = window.open('', '_blank');
  try {
    const blob = await decryptBlob(record);
    const url = URL.createObjectURL(blob);
    const pdfUrl = `${url}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`;
    if (opened) {
      opened.location.href = pdfUrl;
    } else {
      window.open(pdfUrl, '_blank');
    }
    setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
  } catch (e) {
    if (opened) opened.close();
    throw e;
  }
}
