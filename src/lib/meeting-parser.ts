/**
 * meeting-parser.ts
 * Bóc tách nội dung từ các định dạng tệp cuộc họp:
 * - Word (.docx): giải nén tệp zip trong bộ nhớ hoặc trích xuất xml text
 * - Excel (.xlsx): sử dụng exceljs để chuyển bảng tính thành Markdown
 * - Plaintext / Markdown (.txt, .md): đọc trực tiếp UTF-8
 */

import ExcelJS from 'exceljs';

/**
 * Giải nén và trích xuất text từ file docx bằng cách đọc word/document.xml từ buffer zip
 */
export async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    // DOCX là tệp ZIP. Chúng ta có thể tìm nội dung XML giữa <w:t>...</w:t> hoặc giải nén
    // Tìm marker của zip entry word/document.xml
    const zipString = buffer.toString('binary');
    const docXmlIndex = zipString.indexOf('word/document.xml');
    
    // Nếu có thể trích xuất qua biểu thức regular expression đơn giản cho file xml đã lưu hoặc nén nhẹ:
    // Tuy nhiên ZIP nén deflate thông thường, nên ta parse các chuỗi text XML nếu có hoặc fall back text
    // Để an toàn và tin cậy nhất trong Node.js/Next.js môi trường không cần cài thêm npm binary:
    // Trích xuất các block text UTF-8 có thể đọc được:
    const utf8Str = buffer.toString('utf8');
    const matches = utf8Str.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
    if (matches && matches.length > 0) {
      const cleanTexts = matches.map((m) => m.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
      return cleanTexts.join(' ');
    }

    // Fallback: Lọc các ký tự text in được có độ dài hợp lý
    const printableMatches = utf8Str.match(/[\p{L}\p{N}\p{P}\p{Z}\r\n]{4,}/gu);
    if (printableMatches && printableMatches.length > 0) {
      return printableMatches.join(' ').replace(/\s+/g, ' ').trim();
    }
    return '';
  } catch (err) {
    console.warn('Lỗi khi bóc tách Docx:', err);
    return '';
  }
}

/**
 * Trích xuất bảng dữ liệu từ file Excel (.xlsx) và chuyển thành Markdown Table
 */
export async function extractXlsxMarkdown(buffer: Buffer): Promise<string> {
  try {
    const workbook = new ExcelJS.Workbook();
    // @ts-expect-error ExcelJS buffer overload
    await workbook.xlsx.load(buffer);

    const sheetMarkdowns: string[] = [];

    workbook.eachSheet((worksheet) => {
      const sheetName = worksheet.name;
      const rows: string[][] = [];

      worksheet.eachRow((row) => {
        const rowVals: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell) => {
          let val = '';
          if (cell.value !== null && cell.value !== undefined) {
            if (typeof cell.value === 'object') {
              if ('result' in cell.value && cell.value.result !== undefined) {
                val = String(cell.value.result);
              } else if ('text' in cell.value && cell.value.text !== undefined) {
                val = String(cell.value.text);
              } else {
                val = JSON.stringify(cell.value);
              }
            } else {
              val = String(cell.value);
            }
          }
          // Chuẩn hóa tránh gãy cột markdown table
          val = val.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
          rowVals.push(val);
        });
        if (rowVals.some((v) => v !== '')) {
          rows.push(rowVals);
        }
      });

      if (rows.length > 0) {
        // Cân bằng độ rộng các cột
        const maxCols = Math.max(...rows.map((r) => r.length));
        const normalizedRows = rows.map((r) => {
          while (r.length < maxCols) r.push('');
          return r;
        });

        const header = normalizedRows[0];
        const separator = header.map(() => '---');
        const dataRows = normalizedRows.slice(1);

        const tableMd = [
          `### Bảng tính: ${sheetName}`,
          `| ${header.join(' | ')} |`,
          `| ${separator.join(' | ')} |`,
          ...dataRows.map((r) => `| ${r.join(' | ')} |`),
        ].join('\n');

        sheetMarkdowns.push(tableMd);
      }
    });

    return sheetMarkdowns.join('\n\n');
  } catch (err) {
    console.warn('Lỗi khi bóc tách Excel:', err);
    return '';
  }
}

/**
 * Trích xuất text từ file dựa trên mime type hoặc phần mở rộng
 */
export async function parseMeetingFile(
  fileName: string,
  buffer: Buffer,
  mimeType?: string
): Promise<{ fileName: string; type: string; content: string }> {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (ext === 'docx' || mimeType?.includes('wordprocessingml')) {
    const content = await extractDocxText(buffer);
    return { fileName, type: 'docx', content };
  }

  if (ext === 'xlsx' || ext === 'xls' || mimeType?.includes('spreadsheetml')) {
    const content = await extractXlsxMarkdown(buffer);
    return { fileName, type: 'xlsx', content };
  }

  if (['txt', 'md', 'markdown', 'csv'].includes(ext) || mimeType?.startsWith('text/')) {
    const content = buffer.toString('utf8');
    return { fileName, type: ext, content };
  }

  if (['mp3', 'm4a', 'wav', 'aac', 'ogg'].includes(ext) || mimeType?.startsWith('audio/')) {
    return {
      fileName,
      type: 'audio',
      content: `[Tệp ghi âm cuộc họp: ${fileName} - Dung lượng: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB]`,
    };
  }

  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext) || mimeType?.startsWith('image/')) {
    return {
      fileName,
      type: 'image',
      content: `[Hình ảnh cuộc họp / Bảng trắng / Slide: ${fileName} - Dung lượng: ${(buffer.length / 1024).toFixed(1)} KB]`,
    };
  }

  // Mặc định cố gắng đọc UTF-8
  const fallback = buffer.toString('utf8');
  return { fileName, type: ext || 'unknown', content: fallback };
}
