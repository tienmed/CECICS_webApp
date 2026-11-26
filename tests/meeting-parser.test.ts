import { describe, it, expect } from 'vitest';
import { parseMeetingFile } from '../src/lib/meeting-parser';

describe('meeting-parser', () => {
  it('xử lý tệp văn bản thô .txt và .md thành chuỗi utf-8', async () => {
    const rawText = '# Cuộc họp giao ban tuần\nThảo luận về lịch giảng CECICS.';
    const buffer = Buffer.from(rawText, 'utf-8');
    const res = await parseMeetingFile('ghi_chu.md', buffer);
    expect(res.type).toBe('md');
    expect(res.content).toContain('Cuộc họp giao ban tuần');
  });

  it('xử lý tệp âm thanh ghi âm trả về định danh audio kèm dung lượng', async () => {
    const dummyAudio = Buffer.alloc(1024 * 50); // 50KB
    const res = await parseMeetingFile('ghi_am_giao_ban.mp3', dummyAudio);
    expect(res.type).toBe('audio');
    expect(res.content).toContain('Tệp ghi âm cuộc họp');
  });

  it('xử lý tệp hình ảnh chụp bảng/slide trả về định danh image', async () => {
    const dummyImage = Buffer.alloc(1024 * 20); // 20KB
    const res = await parseMeetingFile('bang_trang_slide.png', dummyImage);
    expect(res.type).toBe('image');
    expect(res.content).toContain('Hình ảnh cuộc họp / Bảng trắng / Slide');
  });
});
