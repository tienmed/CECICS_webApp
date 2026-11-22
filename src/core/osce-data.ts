/**
 * OSCE (Objective Structured Clinical Examination) Data & Circuit Flow Logic
 * Trung tâm Kỹ năng & Sáng tạo Mô phỏng Lâm sàng (CECICS) — ĐHYK Phạm Ngọc Thạch
 */

export type OsceStationType = 'SP' | 'MANIKIN' | 'PROCEDURE' | 'STATIC' | 'REST';

export type OsceStationStatus = 'READY' | 'IN_PROGRESS' | 'ALERT' | 'RESTING' | 'ROTATING';

export interface OsceChecklistItem {
  id: string;
  noi_dung: string;
  diem_toi_da: number;
}

export interface OsceStation {
  id: string;
  station_number: number;
  campus_id: 'HH' | 'TN';
  name: string;
  chuyen_khoa: string;
  type: OsceStationType;
  type_label: string;
  room_id: string;
  room_name: string;
  examiner_name: string;
  examiner_title: string;
  examiner_dept: string;
  sp_actor?: string; // Tên diễn viên/Bệnh nhân chuẩn nếu có
  equipment_needed: string[];
  current_candidate: {
    id: string;
    ma_sv: string;
    ho_ten: string;
    lop: string;
    start_time?: string;
  } | null;
  status: OsceStationStatus;
  status_note?: string;
  camera_status: 'LIVE' | 'RECORDING' | 'OFFLINE';
  audio_intercom: boolean;
  score_average?: number;
  checklist: OsceChecklistItem[];
  grid_col: number; // Tọa độ bố trí mặt bằng
  grid_row: number;
}

export interface OsceExam {
  id: string;
  ten_ky_thi: string;
  doi_tuong: string;
  campus_id: 'HH' | 'TN';
  ngay_thi: string; // dd/mm/yyyy
  ca_thi: string; // e.g. "Ca 1 (08:00 - 11:30)"
  thoi_gian_tram_phut: number; // e.g. 7 phút
  thoi_gian_chuyen_tram_giay: number; // e.g. 60 giây (1 phút)
  so_tram: number;
  phong_cho_truoc: string;
  phong_cho_sau: string;
  phong_dieu_hanh: string;
}

// Danh sách các kỳ thi OSCE mẫu tại CECICS
export const INITIAL_OSCE_EXAMS: OsceExam[] = [
  {
    id: 'OSCE-2026-K1',
    ten_ky_thi: 'Thi Tốt nghiệp Bác sĩ Y khoa Đa khoa (OSCE Lâm sàng 8 Trạm)',
    doi_tuong: 'Y6 Đa khoa (Khóa 2020 - 2026)',
    campus_id: 'HH',
    ngay_thi: '24/11/2026',
    ca_thi: 'Ca 1 (08:00 - 11:30)',
    thoi_gian_tram_phut: 7,
    thoi_gian_chuyen_tram_giay: 60,
    so_tram: 8,
    phong_cho_truoc: 'Hội trường P-HH-201 (Khu vực cách ly Trước thi)',
    phong_cho_sau: 'Phòng Hội đồng P-HH-202 (Khu vực cách ly Sau thi)',
    phong_dieu_hanh: 'Phòng AV Trung tâm P-HH-100',
  },
  {
    id: 'OSCE-2026-K2',
    ten_ky_thi: 'Thi Kỹ năng Tiền Lâm sàng Toàn diện Quốc tế 12 Trạm',
    doi_tuong: 'Y3 Đa khoa (Khóa 2023 - 2029)',
    campus_id: 'TN',
    ngay_thi: '27/11/2026',
    ca_thi: 'Ca Sáng (08:30 - 11:45)',
    thoi_gian_tram_phut: 6,
    thoi_gian_chuyen_tram_giay: 45,
    so_tram: 12,
    phong_cho_truoc: 'Hội trường P-TN-301 (Cách ly Trước thi)',
    phong_cho_sau: 'Phòng Hội đồng P-TN-302 (Cách ly Sau thi)',
    phong_dieu_hanh: 'Trung tâm Điều hành AV P-TN-100',
  },
];

// Danh sách trạm mẫu cho Cơ sở Hòa Hưng (8 Trạm chuẩn khép kín)
export const INITIAL_HH_STATIONS: OsceStation[] = [
  {
    id: 'ST-HH-01',
    station_number: 1,
    campus_id: 'HH',
    name: 'Hỏi Bệnh sử & Khám Tim mạch Toàn diện',
    chuyen_khoa: 'Nội Tim mạch',
    type: 'SP',
    type_label: 'Bệnh nhân chuẩn (SP)',
    room_id: 'P-HH-101A',
    room_name: 'Trạm 01 (Phòng P-HH-101A)',
    examiner_name: 'TS.BS. Nguyễn Ngọc Phương Thư',
    examiner_title: 'Trưởng Trung tâm CECICS',
    examiner_dept: 'Bộ môn Nội tổng quát',
    sp_actor: 'SP. Hoàng Minh Trí (Đau thắt ngực khi gắng sức)',
    equipment_needed: ['Ống nghe 3M Littmann Classic', 'Huyết áp kế thủy ngân', 'Đồng hồ bấm giây', 'Hồ sơ bệnh án mẫu'],
    current_candidate: { id: 'CAND-01', ma_sv: '2020-Y6-012', ho_ten: 'Lê Hoàng Nam', lop: 'Y2020A' },
    status: 'IN_PROGRESS',
    camera_status: 'RECORDING',
    audio_intercom: true,
    score_average: 8.8,
    checklist: [
      { id: 'CL-01', noi_dung: 'Chào hỏi, xác định danh tính và giải thích mục đích thăm khám', diem_toi_da: 1.0 },
      { id: 'CL-02', noi_dung: 'Khai thác đầy đủ 7 thuộc tính của triệu chứng đau ngực', diem_toi_da: 2.5 },
      { id: 'CL-03', noi_dung: 'Tư thế khám chuẩn và bộc lộ lồng ngực đúng nguyên tắc bảo vệ quyền riêng tư', diem_toi_da: 1.5 },
      { id: 'CL-04', noi_dung: 'Xác định chính xác vị trí mỏm tim và diện đập bất thường', diem_toi_da: 2.0 },
      { id: 'CL-05', noi_dung: 'Nghe đủ 5 ổ van tim và phát hiện âm thổi tâm thu', diem_toi_da: 3.0 },
    ],
    grid_col: 1,
    grid_row: 1,
  },
  {
    id: 'ST-HH-02',
    station_number: 2,
    campus_id: 'HH',
    name: 'Kỹ năng Nghe Phổi & Phát hiện Rale Bệnh lý',
    chuyen_khoa: 'Nội Hô hấp',
    type: 'MANIKIN',
    type_label: 'Mô hình nghe SimMan/Harvey',
    room_id: 'P-HH-101B',
    room_name: 'Trạm 02 (Phòng P-HH-101B)',
    examiner_name: 'ThS.BS. Đỗ Anh Khoa',
    examiner_title: 'Giảng viên chính',
    examiner_dept: 'Bộ môn Nội tổng quát',
    equipment_needed: ['Mô hình mô phỏng âm phế bào SimMan 3G', 'Bộ phát âm bệnh lý phế quản', 'Ống nghe Littmann'],
    current_candidate: { id: 'CAND-02', ma_sv: '2020-Y6-015', ho_ten: 'Trần Thị Kim Oanh', lop: 'Y2020A' },
    status: 'IN_PROGRESS',
    camera_status: 'RECORDING',
    audio_intercom: true,
    score_average: 8.2,
    checklist: [
      { id: 'CL-06', noi_dung: 'Kỹ thuật đặt màng nghe đối xứng 2 bên từ đỉnh xuống đáy phổi', diem_toi_da: 2.0 },
      { id: 'CL-07', noi_dung: 'Phân biệt chính xác tiếng rì rào phế nang giảm và rale nổ đáy phổi phải', diem_toi_da: 3.5 },
      { id: 'CL-08', noi_dung: 'Hướng dẫn bệnh nhân thở sâu đều đặn qua miệng đúng chuẩn', diem_toi_da: 1.5 },
      { id: 'CL-09', noi_dung: 'Đưa ra nhận định chẩn đoán phân biệt hội chứng đông đặc phổi', diem_toi_da: 3.0 },
    ],
    grid_col: 2,
    grid_row: 1,
  },
  {
    id: 'ST-HH-03',
    station_number: 3,
    campus_id: 'HH',
    name: 'Thăm Khám Bụng, Gan Lách & Điểm Đau Ngoại Khoa',
    chuyen_khoa: 'Ngoại Tổng quát',
    type: 'SP',
    type_label: 'Bệnh nhân chuẩn (SP)',
    room_id: 'P-HH-101C',
    room_name: 'Trạm 03 (Phòng P-HH-101C)',
    examiner_name: 'BS.CKI. Nguyễn Hoàng Phúc',
    examiner_title: 'Giảng viên Thỉnh giảng',
    examiner_dept: 'Bộ môn Ngoại tổng quát',
    sp_actor: 'SP. Trần Văn Bình (Đau hạ sườn phải nghi viêm túi mật)',
    equipment_needed: ['Giường khám bệnh đa năng', 'Thước đo gan', 'Găng tay y tế vô khuẩn', 'Đèn khám'],
    current_candidate: { id: 'CAND-03', ma_sv: '2020-Y6-022', ho_ten: 'Vũ Đức Thịnh', lop: 'Y2020A' },
    status: 'IN_PROGRESS',
    camera_status: 'RECORDING',
    audio_intercom: true,
    score_average: 8.5,
    checklist: [
      { id: 'CL-10', noi_dung: 'Bộc lộ vùng bụng từ mũi ức đến khớp mu đúng quy cách', diem_toi_da: 1.0 },
      { id: 'CL-11', noi_dung: 'Nhìn, Nghe nhu động ruột trước khi Gõ và Sờ', diem_toi_da: 2.5 },
      { id: 'CL-12', noi_dung: 'Khám dấu Murphy đúng vị trí điểm túi mật và cách hít sâu', diem_toi_da: 3.5 },
      { id: 'CL-13', noi_dung: 'Xác định chính xác bờ dưới của gan bằng kỹ thuật sờ sâu', diem_toi_da: 3.0 },
    ],
    grid_col: 3,
    grid_row: 1,
  },
  {
    id: 'ST-HH-04',
    station_number: 4,
    campus_id: 'HH',
    name: 'Hồi Sức Tim Phổi Cơ Bản & Nâng Cao (BLS / ACLS)',
    chuyen_khoa: 'Hồi sức Cấp cứu',
    type: 'MANIKIN',
    type_label: 'Mô hình QCPR Cấp cứu',
    room_id: 'P-HH-101D',
    room_name: 'Trạm 04 (Phòng P-HH-101D)',
    examiner_name: 'ThS.BS. Nguyễn Minh Luân',
    examiner_title: 'Giảng viên Hồi sức',
    examiner_dept: 'Bộ môn Hồi sức Cấp cứu',
    equipment_needed: ['Mô hình toàn thân Resusci Anne QCPR', 'Máy khử rung tim tự động ngoài AED Trainer', 'Bóng Ambu & Mặt nạ'],
    current_candidate: { id: 'CAND-04', ma_sv: '2020-Y6-029', ho_ten: 'Phạm Quỳnh Anh', lop: 'Y2020A' },
    status: 'IN_PROGRESS',
    camera_status: 'RECORDING',
    audio_intercom: true,
    score_average: 9.1,
    checklist: [
      { id: 'CL-14', noi_dung: 'Đánh giá an toàn hiện trường, tri giác và bắt mạch cảnh trong 10 giây', diem_toi_da: 2.0 },
      { id: 'CL-15', noi_dung: 'Kỹ thuật ép tim đúng tần số 100-120 l/p, độ sâu 5-6 cm, để ngực nở hoàn toàn', diem_toi_da: 3.5 },
      { id: 'CL-16', noi_dung: 'Vận hành máy AED đúng quy trình, dán điện cực và hô rõ Clear an toàn trước sốc', diem_toi_da: 3.0 },
      { id: 'CL-17', noi_dung: 'Duy trì tỷ lệ Ép tim : Thông khí = 30 : 2 chuẩn xác', diem_toi_da: 1.5 },
    ],
    grid_col: 4,
    grid_row: 1,
  },
  {
    id: 'ST-HH-05',
    station_number: 5,
    campus_id: 'HH',
    name: 'Đặt Nội Khí Quản & Xử Trí Đường Thở Khó',
    chuyen_khoa: 'Gây mê Hồi sức',
    type: 'PROCEDURE',
    type_label: 'Thủ thuật Lâm sàng',
    room_id: 'P-HH-102A',
    room_name: 'Trạm 05 (Phòng P-HH-102A)',
    examiner_name: 'BS.CKII. Huỳnh Ngọc Mai',
    examiner_title: 'Đầu mối BM Nội',
    examiner_dept: 'Bộ môn Nội tổng quát',
    equipment_needed: ['Mô hình đầu cổ Airway Management Trainer', 'Đèn soi thanh quản lưỡi cong Macintosh số 3/4', 'Ống nội khí quản số 7.5', 'Stylet kẽm vô khuẩn'],
    current_candidate: { id: 'CAND-05', ma_sv: '2020-Y6-033', ho_ten: 'Đoàn Gia Bảo', lop: 'Y2020A' },
    status: 'IN_PROGRESS',
    camera_status: 'RECORDING',
    audio_intercom: true,
    score_average: 8.4,
    checklist: [
      { id: 'CL-18', noi_dung: 'Kiểm tra bóng chèn cuff và độ sáng của đèn soi thanh quản trước khi làm', diem_toi_da: 1.5 },
      { id: 'CL-19', noi_dung: 'Tư thế đầu bệnh nhân chuẩn sniffing position, mở miệng bằng kỹ thuật bắt chéo ngón tay', diem_toi_da: 2.0 },
      { id: 'CL-20', noi_dung: 'Đưa lưỡi đèn gạt lưỡi sang trái, nâng đèn hướng 45 độ thấy rõ dây thanh âm Cormack-Lehane độ 1-2', diem_toi_da: 3.5 },
      { id: 'CL-21', noi_dung: 'Bơm bóng cuff, bóp bóng kiểm tra thông khí 5 điểm (2 đỉnh, 2 đáy và thượng vị)', diem_toi_da: 3.0 },
    ],
    grid_col: 4,
    grid_row: 2,
  },
  {
    id: 'ST-HH-06',
    station_number: 6,
    campus_id: 'HH',
    name: 'Khâu Vết Thương Rách Da & Đảm Bảo Vô Khuẩn',
    chuyen_khoa: 'Ngoại Chấn thương',
    type: 'PROCEDURE',
    type_label: 'Thủ thuật Lâm sàng',
    room_id: 'P-HH-102B',
    room_name: 'Trạm 06 (Phòng P-HH-102B)',
    examiner_name: 'ThS.BS.CKII. Bùi Phan Quỳnh Phương',
    examiner_title: 'Giảng viên Ngoại',
    examiner_dept: 'Bộ môn Ngoại tổng quát',
    equipment_needed: ['Bàn mô hình da đa lớp Suture Pad', 'Bộ khâu vô khuẩn (Kẹp mang kim, nhíp có mấu, kéo cắt chỉ)', 'Chỉ Nylon 4-0', 'Povidine sát trùng'],
    current_candidate: { id: 'CAND-06', ma_sv: '2020-Y6-041', ho_ten: 'Nguyễn Thị Bích Trâm', lop: 'Y2020A' },
    status: 'IN_PROGRESS',
    camera_status: 'RECORDING',
    audio_intercom: true,
    score_average: 8.6,
    checklist: [
      { id: 'CL-22', noi_dung: 'Mang găng vô khuẩn đúng quy trình không chạm mặt ngoài găng', diem_toi_da: 1.5 },
      { id: 'CL-23', noi_dung: 'Sát khuẩn vết thương theo hình xoắn ốc từ trong ra ngoài', diem_toi_da: 1.5 },
      { id: 'CL-24', noi_dung: 'Góc đâm kim 90 độ, lấy trọn lớp chân bì, mép vết thương áp sát không chồng mép', diem_toi_da: 4.0 },
      { id: 'CL-25', noi_dung: 'Thắt nút chỉ bằng dụng cụ 3 nút chuẩn, nút chỉ nằm lệch về một bên vết khâu', diem_toi_da: 3.0 },
    ],
    grid_col: 3,
    grid_row: 2,
  },
  {
    id: 'ST-HH-07',
    station_number: 7,
    campus_id: 'HH',
    name: 'Đọc & Diễn Giải Điện Tâm Đồ (ECG) & X-Quang Ngực',
    chuyen_khoa: 'Chẩn đoán Hình ảnh & Cận lâm sàng',
    type: 'STATIC',
    type_label: 'Trạm tĩnh (Tình huống LS & Phim)',
    room_id: 'P-HH-102C',
    room_name: 'Trạm 07 (Phòng P-HH-102C)',
    examiner_name: 'ThS.BS. Trần Tú Trinh',
    examiner_title: 'Giảng viên Cận lâm sàng',
    examiner_dept: 'Bộ môn Chẩn đoán hình ảnh',
    equipment_needed: ['Trạm máy tính màn hình độ phân giải cao PACS', 'Hộp đèn đọc phim X-Quang tiêu chuẩn', 'Bản in ECG 12 chuyển đạo có bệnh lý'],
    current_candidate: { id: 'CAND-07', ma_sv: '2020-Y6-050', ho_ten: 'Lâm Quốc Bảo', lop: 'Y2020A' },
    status: 'IN_PROGRESS',
    camera_status: 'RECORDING',
    audio_intercom: true,
    score_average: 8.9,
    checklist: [
      { id: 'CL-26', noi_dung: 'Kiểm tra hành chính, tốc độ kéo giấy 25mm/s và chuẩn điện thế 10mm/1mV', diem_toi_da: 1.5 },
      { id: 'CL-27', noi_dung: 'Xác định nhịp xoang, tần số tim và trục điện tim', diem_toi_da: 2.0 },
      { id: 'CL-28', noi_dung: 'Nhận diện hình ảnh nhồi máu cơ tim ST chênh lên vùng trước rộng (V1-V4)', diem_toi_da: 3.5 },
      { id: 'CL-29', noi_dung: 'Phân tích bóng tim to và tràn dịch màng phổi trên phim X-Quang ngực thẳng', diem_toi_da: 3.0 },
    ],
    grid_col: 2,
    grid_row: 2,
  },
  {
    id: 'ST-HH-08',
    station_number: 8,
    campus_id: 'HH',
    name: 'Kỹ Năng Giao Tiếp Y Khoa & Giải Thích Bệnh (SPIKES)',
    chuyen_khoa: 'Y đức & Kỹ năng Giao tiếp',
    type: 'SP',
    type_label: 'Bệnh nhân chuẩn (SP)',
    room_id: 'P-HH-102D',
    room_name: 'Trạm 08 (Phòng P-HH-102D)',
    examiner_name: 'TS. Đặng Trần Ngọc Thanh',
    examiner_title: 'Trưởng Khoa',
    examiner_dept: 'Ban Lãnh đạo',
    sp_actor: 'SP. Lê Thị Mỹ Lệ (Thân nhân lo lắng khi nghe tin bệnh nhân chuyển biến nặng)',
    equipment_needed: ['Bàn ghế tư vấn chuyên dụng', 'Tập thông tin bệnh nhân giả định', 'Micro ghi âm đánh giá ngôn ngữ'],
    current_candidate: { id: 'CAND-08', ma_sv: '2020-Y6-055', ho_ten: 'Võ Mai Phương', lop: 'Y2020A' },
    status: 'IN_PROGRESS',
    camera_status: 'RECORDING',
    audio_intercom: true,
    score_average: 9.3,
    checklist: [
      { id: 'CL-30', noi_dung: 'Chuẩn bị không gian yên tĩnh, ngồi ngang tầm mắt và thái độ lắng nghe tích cực', diem_toi_da: 1.5 },
      { id: 'CL-31', noi_dung: 'Thăm dò nhận thức của thân nhân về tình trạng bệnh hiện tại (Perception)', diem_toi_da: 2.5 },
      { id: 'CL-32', noi_dung: 'Đưa ra cảnh báo tâm lý trước khi thông báo chẩn đoán nặng (Warning shot)', diem_toi_da: 2.0 },
      { id: 'CL-33', noi_dung: 'Đồng cảm và nâng đỡ cảm xúc khi thân nhân xúc động (Empathy & Strategy)', diem_toi_da: 4.0 },
    ],
    grid_col: 1,
    grid_row: 2,
  },
];

// Danh sách trạm mẫu cho Cơ sở Tân Nhật (12 Trạm chuẩn quốc tế)
export const INITIAL_TN_STATIONS: OsceStation[] = [
  {
    id: 'ST-TN-01',
    station_number: 1,
    campus_id: 'TN',
    name: 'Hỏi Bệnh sử & Khám Tim mạch',
    chuyen_khoa: 'Nội Tim mạch',
    type: 'SP',
    type_label: 'Bệnh nhân chuẩn (SP)',
    room_id: 'P-TN-101A',
    room_name: 'Trạm 01 (P-TN-101A)',
    examiner_name: 'TS.BS. Nguyễn Ngọc Phương Thư',
    examiner_title: 'Trưởng Trung tâm CECICS',
    examiner_dept: 'Bộ môn Nội tổng quát',
    equipment_needed: ['Ống nghe Littmann', 'Huyết áp kế'],
    current_candidate: { id: 'CAND-T01', ma_sv: '2023-Y3-001', ho_ten: 'Lê Gia Huy', lop: 'Y2023A' },
    status: 'IN_PROGRESS',
    camera_status: 'RECORDING',
    audio_intercom: true,
    score_average: 8.5,
    checklist: [{ id: 'CL-T01', noi_dung: 'Khai thác hoàn cảnh khởi phát và tính chất đau ngực', diem_toi_da: 5.0 }, { id: 'CL-T02', noi_dung: 'Nghe tim đủ 5 ổ van chuẩn', diem_toi_da: 5.0 }],
    grid_col: 1,
    grid_row: 1,
  },
  {
    id: 'ST-TN-02',
    station_number: 2,
    campus_id: 'TN',
    name: 'Khám Hô Hấp & Phế Âm Bệnh Lý',
    chuyen_khoa: 'Nội Hô hấp',
    type: 'MANIKIN',
    type_label: 'Mô hình SimMan',
    room_id: 'P-TN-101B',
    room_name: 'Trạm 02 (P-TN-101B)',
    examiner_name: 'ThS.BS. Đỗ Anh Khoa',
    examiner_title: 'Giảng viên',
    examiner_dept: 'Bộ môn Nội tổng quát',
    equipment_needed: ['Mô hình SimMan Hô hấp'],
    current_candidate: { id: 'CAND-T02', ma_sv: '2023-Y3-008', ho_ten: 'Đỗ Thị Mỹ Duyên', lop: 'Y2023A' },
    status: 'IN_PROGRESS',
    camera_status: 'RECORDING',
    audio_intercom: true,
    score_average: 8.7,
    checklist: [{ id: 'CL-T03', noi_dung: 'So sánh âm phế bào đối xứng 2 phế trường', diem_toi_da: 10.0 }],
    grid_col: 2,
    grid_row: 1,
  },
  {
    id: 'ST-TN-03',
    station_number: 3,
    campus_id: 'TN',
    name: 'Khám Bụng & Gan Lách Ngoại Khoa',
    chuyen_khoa: 'Ngoại Tổng quát',
    type: 'SP',
    type_label: 'Bệnh nhân chuẩn (SP)',
    room_id: 'P-TN-101C',
    room_name: 'Trạm 03 (P-TN-101C)',
    examiner_name: 'BS.CKI. Nguyễn Hoàng Phúc',
    examiner_title: 'Giảng viên',
    examiner_dept: 'Bộ môn Ngoại tổng quát',
    equipment_needed: ['Giường khám bệnh', 'Thước đo'],
    current_candidate: { id: 'CAND-T03', ma_sv: '2023-Y3-014', ho_ten: 'Nguyễn Tấn Đạt', lop: 'Y2023A' },
    status: 'IN_PROGRESS',
    camera_status: 'RECORDING',
    audio_intercom: true,
    score_average: 8.4,
    checklist: [{ id: 'CL-T04', noi_dung: 'Khám phản ứng dội và đề kháng thành bụng', diem_toi_da: 10.0 }],
    grid_col: 3,
    grid_row: 1,
  },
  {
    id: 'ST-TN-04',
    station_number: 4,
    campus_id: 'TN',
    name: 'Khám Thần Kinh & 12 Đôi Dây Sọ',
    chuyen_khoa: 'Nội Thần kinh',
    type: 'SP',
    type_label: 'Bệnh nhân chuẩn (SP)',
    room_id: 'P-TN-101D',
    room_name: 'Trạm 04 (P-TN-101D)',
    examiner_name: 'BS.CKII. Huỳnh Ngọc Mai',
    examiner_title: 'Đầu mối BM Nội',
    examiner_dept: 'Bộ môn Nội tổng quát',
    equipment_needed: ['Búa gõ phản xạ gân cơ', 'Đèn soi đồng tử', 'Bảng thị lực Snellen'],
    current_candidate: { id: 'CAND-T04', ma_sv: '2023-Y3-021', ho_ten: 'Lê Minh Quân', lop: 'Y2023A' },
    status: 'IN_PROGRESS',
    camera_status: 'RECORDING',
    audio_intercom: true,
    score_average: 9.0,
    checklist: [{ id: 'CL-T05', noi_dung: 'Khám phản xạ đồng tử và vận nhãn các hướng', diem_toi_da: 10.0 }],
    grid_col: 4,
    grid_row: 1,
  },
  {
    id: 'ST-TN-05',
    station_number: 5,
    campus_id: 'TN',
    name: 'Hồi Sức Cấp Cứu CPR & Phá Rung AED',
    chuyen_khoa: 'Hồi sức Cấp cứu',
    type: 'MANIKIN',
    type_label: 'Mô hình QCPR',
    room_id: 'P-TN-102A',
    room_name: 'Trạm 05 (P-TN-102A)',
    examiner_name: 'ThS.BS. Nguyễn Minh Luân',
    examiner_title: 'Giảng viên',
    examiner_dept: 'Bộ môn Hồi sức Cấp cứu',
    equipment_needed: ['Mô hình Resusci Anne QCPR', 'Máy AED Trainer'],
    current_candidate: { id: 'CAND-T05', ma_sv: '2023-Y3-025', ho_ten: 'Trần Thảo Vy', lop: 'Y2023A' },
    status: 'IN_PROGRESS',
    camera_status: 'RECORDING',
    audio_intercom: true,
    score_average: 8.9,
    checklist: [{ id: 'CL-T06', noi_dung: 'Ép tim liên tục đúng kỹ thuật và dán máy phá rung', diem_toi_da: 10.0 }],
    grid_col: 4,
    grid_row: 2,
  },
  {
    id: 'ST-TN-06',
    station_number: 6,
    campus_id: 'TN',
    name: 'Đặt Nội Khí Quản Khẩn Cấp',
    chuyen_khoa: 'Gây mê Hồi sức',
    type: 'PROCEDURE',
    type_label: 'Thủ thuật Lâm sàng',
    room_id: 'P-TN-102B',
    room_name: 'Trạm 06 (P-TN-102B)',
    examiner_name: 'ThS.ĐD. Võ Kim Ngân',
    examiner_title: 'Phụ trách BM',
    examiner_dept: 'Bộ môn Điều dưỡng',
    equipment_needed: ['Mô hình đặt NKQ', 'Đèn Macintosh', 'Ống NKQ'],
    current_candidate: { id: 'CAND-T06', ma_sv: '2023-Y3-030', ho_ten: 'Hoàng Nhật Minh', lop: 'Y2023A' },
    status: 'IN_PROGRESS',
    camera_status: 'RECORDING',
    audio_intercom: true,
    score_average: 8.3,
    checklist: [{ id: 'CL-T07', noi_dung: 'Kỹ thuật soi thanh quản và định vị đúng khí quản', diem_toi_da: 10.0 }],
    grid_col: 4,
    grid_row: 3,
  },
  {
    id: 'ST-TN-07',
    station_number: 7,
    campus_id: 'TN',
    name: 'Khâu Da & Chăm Sóc Vết Thương',
    chuyen_khoa: 'Ngoại Khoa',
    type: 'PROCEDURE',
    type_label: 'Thủ thuật Ngoại',
    room_id: 'P-TN-102C',
    room_name: 'Trạm 07 (P-TN-102C)',
    examiner_name: 'ThS.BS.CKII. Bùi Phan Quỳnh Phương',
    examiner_title: 'Giảng viên',
    examiner_dept: 'Bộ môn Ngoại tổng quát',
    equipment_needed: ['Bàn mô hình khâu da', 'Bộ dụng cụ khâu tiểu phẫu'],
    current_candidate: { id: 'CAND-T07', ma_sv: '2023-Y3-035', ho_ten: 'Lâm Bích Ngọc', lop: 'Y2023A' },
    status: 'IN_PROGRESS',
    camera_status: 'RECORDING',
    audio_intercom: true,
    score_average: 8.8,
    checklist: [{ id: 'CL-T08', noi_dung: 'Đảm bảo vô khuẩn và mũi khâu đơn chuẩn góc 90 độ', diem_toi_da: 10.0 }],
    grid_col: 3,
    grid_row: 3,
  },
  {
    id: 'ST-TN-08',
    station_number: 8,
    campus_id: 'TN',
    name: 'Thăm Khám Sản Phụ Khoa & Tim Thai',
    chuyen_khoa: 'Sản Phụ khoa',
    type: 'MANIKIN',
    type_label: 'Mô hình Sản Lucina',
    room_id: 'P-TN-101 (Phân khu Sản)',
    room_name: 'Trạm 08 (P-TN-101 Sản)',
    examiner_name: 'ThS.BS. Trần Tú Trinh',
    examiner_title: 'Giảng viên',
    examiner_dept: 'Bộ môn Sản phụ khoa',
    equipment_needed: ['Mô hình sản khoa mô phỏng Lucina', 'Đầu dò nghe tim thai Doppler'],
    current_candidate: { id: 'CAND-T08', ma_sv: '2023-Y3-040', ho_ten: 'Phan Minh Khang', lop: 'Y2023A' },
    status: 'IN_PROGRESS',
    camera_status: 'RECORDING',
    audio_intercom: true,
    score_average: 8.6,
    checklist: [{ id: 'CL-T09', noi_dung: '4 thủ thuật Leopold và đo chiều cao tử cung', diem_toi_da: 10.0 }],
    grid_col: 2,
    grid_row: 3,
  },
  {
    id: 'ST-TN-09',
    station_number: 9,
    campus_id: 'TN',
    name: 'Đánh Giá Cấp Cứu Nhi Khoa (PALS)',
    chuyen_khoa: 'Nhi Khoa',
    type: 'MANIKIN',
    type_label: 'Mô hình Nhi BabySim',
    room_id: 'P-TN-101 (Phân khu Nhi)',
    room_name: 'Trạm 09 (P-TN-101 Nhi)',
    examiner_name: 'ThS.ĐD. Cao Thị Ngọc Bích',
    examiner_title: 'Giảng viên',
    examiner_dept: 'Bộ môn Nhi',
    equipment_needed: ['Mô hình Nhi mô phỏng BabySim', 'Thước đo Broselow'],
    current_candidate: { id: 'CAND-T09', ma_sv: '2023-Y3-044', ho_ten: 'Vũ Thanh Hằng', lop: 'Y2023A' },
    status: 'IN_PROGRESS',
    camera_status: 'RECORDING',
    audio_intercom: true,
    score_average: 9.1,
    checklist: [{ id: 'CL-T10', noi_dung: 'Tam giác đánh giá Nhi khoa PAT và chỉ số sinh tồn', diem_toi_da: 10.0 }],
    grid_col: 1,
    grid_row: 3,
  },
  {
    id: 'ST-TN-10',
    station_number: 10,
    campus_id: 'TN',
    name: 'Đọc ECG 12 Cần & X-Quang Ngực',
    chuyen_khoa: 'Cận lâm sàng',
    type: 'STATIC',
    type_label: 'Trạm tĩnh',
    room_id: 'P-TN-301A',
    room_name: 'Trạm 10 (P-TN-301A)',
    examiner_name: 'BS.CKII. Huỳnh Ngọc Mai',
    examiner_title: 'Giảng viên',
    examiner_dept: 'Bộ môn Chẩn đoán hình ảnh',
    equipment_needed: ['Màn hình chẩn đoán PACS', 'Bộ hồ sơ phim'],
    current_candidate: { id: 'CAND-T10', ma_sv: '2023-Y3-049', ho_ten: 'Đặng Tuấn Tú', lop: 'Y2023A' },
    status: 'IN_PROGRESS',
    camera_status: 'RECORDING',
    audio_intercom: true,
    score_average: 8.7,
    checklist: [{ id: 'CL-T11', noi_dung: 'Chẩn đoán rối loạn nhịp và tổn thương phổi', diem_toi_da: 10.0 }],
    grid_col: 1,
    grid_row: 2,
  },
  {
    id: 'ST-TN-11',
    station_number: 11,
    campus_id: 'TN',
    name: 'Giao Tiếp Y Khoa & Khai Thác Tiền Sử',
    chuyen_khoa: 'Y đức',
    type: 'SP',
    type_label: 'Bệnh nhân chuẩn (SP)',
    room_id: 'P-TN-301B',
    room_name: 'Trạm 11 (P-TN-301B)',
    examiner_name: 'TS. Đặng Trần Ngọc Thanh',
    examiner_title: 'Trưởng Khoa',
    examiner_dept: 'Ban Lãnh đạo',
    sp_actor: 'SP. Nguyễn Thị Mai',
    equipment_needed: ['Bàn tư vấn'],
    current_candidate: { id: 'CAND-T11', ma_sv: '2023-Y3-053', ho_ten: 'Trần Hoài Nam', lop: 'Y2023A' },
    status: 'IN_PROGRESS',
    camera_status: 'RECORDING',
    audio_intercom: true,
    score_average: 9.4,
    checklist: [{ id: 'CL-T12', noi_dung: 'Kỹ năng lắng nghe tích cực và thấu cảm', diem_toi_da: 10.0 }],
    grid_col: 2,
    grid_row: 2,
  },
  {
    id: 'ST-TN-12',
    station_number: 12,
    campus_id: 'TN',
    name: 'Trạm Nghỉ & Chuẩn Bị Hoàn Tất (Rest Station)',
    chuyen_khoa: 'Nghỉ ngơi',
    type: 'REST',
    type_label: 'Trạm Nghỉ (Rest)',
    room_id: 'P-TN-301C',
    room_name: 'Trạm 12 (P-TN-301C - Trạm Nghỉ)',
    examiner_name: 'Cán bộ Giám sát Hành lang',
    examiner_title: 'Giám thị',
    examiner_dept: 'Đơn vị Hành chính',
    equipment_needed: ['Bàn ghế nghỉ', 'Nước uống', 'Đồng hồ đếm ngược'],
    current_candidate: { id: 'CAND-T12', ma_sv: '2023-Y3-058', ho_ten: 'Võ Thị Hồng', lop: 'Y2023A' },
    status: 'RESTING',
    camera_status: 'LIVE',
    audio_intercom: true,
    score_average: 10.0,
    checklist: [{ id: 'CL-T13', noi_dung: 'Nghỉ ngơi yên tĩnh không thảo luận với thí sinh khác', diem_toi_da: 10.0 }],
    grid_col: 3,
    grid_row: 2,
  },
];

// Danh sách thí sinh trong hàng chờ (Phòng chờ trước thi)
export const INITIAL_HOLDING_QUEUE = [
  { id: 'CAND-09', ma_sv: '2020-Y6-061', ho_ten: 'Trần Đại Nghĩa', lop: 'Y2020B', status: 'Sẵn sàng chờ vào trạm' },
  { id: 'CAND-10', ma_sv: '2020-Y6-064', ho_ten: 'Nguyễn Thị Cẩm Tú', lop: 'Y2020B', status: 'Sẵn sàng chờ vào trạm' },
  { id: 'CAND-11', ma_sv: '2020-Y6-072', ho_ten: 'Huỳnh Văn Thành', lop: 'Y2020B', status: 'Đã điểm danh & nộp điện thoại' },
  { id: 'CAND-12', ma_sv: '2020-Y6-080', ho_ten: 'Lý Quốc Cường', lop: 'Y2020B', status: 'Đã điểm danh & nộp điện thoại' },
  { id: 'CAND-13', ma_sv: '2020-Y6-085', ho_ten: 'Phan Như Quỳnh', lop: 'Y2020B', status: 'Đã điểm danh' },
  { id: 'CAND-14', ma_sv: '2020-Y6-092', ho_ten: 'Đặng Tuấn Kiệt', lop: 'Y2020B', status: 'Đã điểm danh' },
];

// Danh sách thí sinh đã hoàn thành vòng thi (Phòng cách ly sau thi)
export const INITIAL_COMPLETED_CANDIDATES = [
  { id: 'CAND-P01', ma_sv: '2020-Y6-001', ho_ten: 'Bùi Anh Tuấn', lop: 'Y2020A', diem_tb: 8.75, hoan_thanh_luc: '08:45' },
  { id: 'CAND-P02', ma_sv: '2020-Y6-003', ho_ten: 'Trịnh Thùy Linh', lop: 'Y2020A', diem_tb: 9.10, hoan_thanh_luc: '08:45' },
  { id: 'CAND-P03', ma_sv: '2020-Y6-007', ho_ten: 'Mai Văn Dũng', lop: 'Y2020A', diem_tb: 8.40, hoan_thanh_luc: '08:45' },
];

/**
 * Hàm luân chuyển thí sinh giữa các trạm (Rotate Candidates Circuit)
 * Thí sinh trạm K chuyển sang trạm K+1.
 * Thí sinh trạm cuối cùng (Trạm 8) chuyển sang Phòng cách ly sau thi.
 * Thí sinh đầu tiên từ Hàng chờ bước vào Trạm 1.
 */
export function rotateOsceCircuit(
  stations: OsceStation[],
  queue: typeof INITIAL_HOLDING_QUEUE,
  completed: typeof INITIAL_COMPLETED_CANDIDATES,
  currentTimeStr: string = '09:00'
) {
  const newStations = stations.map((s) => ({ ...s }));
  const newQueue = [...queue];
  const newCompleted = [...completed];

  // Thí sinh ở trạm cuối cùng hoàn thành vòng thi
  const lastStation = newStations[newStations.length - 1];
  if (lastStation && lastStation.current_candidate) {
    newCompleted.unshift({
      id: lastStation.current_candidate.id,
      ma_sv: lastStation.current_candidate.ma_sv,
      ho_ten: lastStation.current_candidate.ho_ten,
      lop: lastStation.current_candidate.lop,
      diem_tb: +(Math.random() * 1.5 + 8.0).toFixed(2), // Giả lập điểm TB trạm
      hoan_thanh_luc: currentTimeStr,
    });
  }

  // Luân chuyển lùi từ trạm cuối về trạm 2: Trạm i nhận thí sinh từ Trạm i - 1
  for (let i = newStations.length - 1; i >= 1; i--) {
    newStations[i].current_candidate = newStations[i - 1].current_candidate;
    newStations[i].status = newStations[i].current_candidate ? 'IN_PROGRESS' : 'READY';
  }

  // Trạm 1 nhận thí sinh mới từ Hàng chờ
  if (newQueue.length > 0) {
    const nextCand = newQueue.shift()!;
    newStations[0].current_candidate = {
      id: nextCand.id,
      ma_sv: nextCand.ma_sv,
      ho_ten: nextCand.ho_ten,
      lop: nextCand.lop,
      start_time: currentTimeStr,
    };
    newStations[0].status = 'IN_PROGRESS';
  } else {
    newStations[0].current_candidate = null;
    newStations[0].status = 'READY';
  }

  return {
    stations: newStations,
    queue: newQueue,
    completed: newCompleted,
  };
}
