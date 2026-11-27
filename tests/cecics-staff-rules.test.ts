import { describe, it, expect } from 'vitest';
import {
  isCecicsInternalStaff,
  validateInternalRecipient,
  filterInternalRecipients,
  CECICS_OFFICIAL_STAFF_EMAILS,
} from '../src/core/cecics-staff';

describe('Quy tắc bảo mật Email ngoài nhân sự CECICS', () => {
  it('xác định đúng 18 nhân sự chính thức của CECICS là nội bộ', () => {
    expect(isCecicsInternalStaff('bstien@pnt.edu.vn')).toBe(true);
    expect(isCecicsInternalStaff('nguyenngocphuongthu@pnt.edu.vn')).toBe(true);
    expect(isCecicsInternalStaff('thunnp@pnt.edu.vn')).toBe(true);
    expect(isCecicsInternalStaff('cuongnt.ttmpls@pnt.edu.vn')).toBe(true);
  });

  it('xác định giảng viên có FTE 50% tại CECICS (Võ Thị Tố Uyên, Đặng Công Duy) là thành viên nhận thông tin nội bộ', () => {
    expect(isCecicsInternalStaff('uyen_vtt@pnt.edu.vn')).toBe(true);
    expect(isCecicsInternalStaff('uyenvtt@pnt.edu.vn')).toBe(true);
    expect(isCecicsInternalStaff('duydc@pnt.edu.vn')).toBe(true);
    const resUyên = validateInternalRecipient('uyen_vtt@pnt.edu.vn');
    expect(resUyên.allowed).toBe(true);
    expect(resUyên.isInternal).toBe(true);
    const resDuy = validateInternalRecipient('duydc@pnt.edu.vn');
    expect(resDuy.allowed).toBe(true);
    expect(resDuy.isInternal).toBe(true);
  });

  it('xác định thanhdtn@pnt.edu.vn là email ngoài nhân sự CECICS', () => {
    expect(isCecicsInternalStaff('thanhdtn@pnt.edu.vn')).toBe(false);
  });

  it('chặn gửi thông tin nội bộ tự động cho thanhdtn@pnt.edu.vn khi không chỉ định đích danh', () => {
    const res = validateInternalRecipient('thanhdtn@pnt.edu.vn');
    expect(res.allowed).toBe(false);
    expect(res.isInternal).toBe(false);
    expect(res.reason).toContain('là email ngoài nhân sự Trung tâm CECICS');
  });

  it('cho phép gửi cho thanhdtn@pnt.edu.vn khi có chỉ định đích danh cụ thể', () => {
    const res = validateInternalRecipient('thanhdtn@pnt.edu.vn', {
      isExplicitSingleTarget: true,
    });
    expect(res.allowed).toBe(true);
    expect(res.isInternal).toBe(false);
  });

  it('cho phép gửi cho thanhdtn@pnt.edu.vn theo dạng gửi cho danh sách ngoài', () => {
    const res = validateInternalRecipient('thanhdtn@pnt.edu.vn', {
      isExternalDispatchList: true,
    });
    expect(res.allowed).toBe(true);
    expect(res.isInternal).toBe(false);
  });

  it('lọc danh sách tự động nội bộ và loại bỏ thanhdtn@pnt.edu.vn khỏi danh sách nội bộ', () => {
    const mixedList = [
      'bstien@pnt.edu.vn',
      'thanhdtn@pnt.edu.vn',
      'linhntm@pnt.edu.vn',
      'ngoainhanluc@gmail.com',
    ];
    const { validInternalEmails, blockedExternalEmails } = filterInternalRecipients(mixedList);

    expect(validInternalEmails).toEqual(['bstien@pnt.edu.vn', 'linhntm@pnt.edu.vn']);
    expect(blockedExternalEmails).toEqual(['thanhdtn@pnt.edu.vn', 'ngoainhanluc@gmail.com']);
  });
});
