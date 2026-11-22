import { resetLocalDb } from '../src/lib/local-store';

const db = resetLocalDb();
console.log(
  `Đã khởi tạo lại dữ liệu mẫu tại .data/db.json: ${db.Users.length} người dùng, ${db.Rooms.length} phòng, ${db.Sessions.length} buổi học, ${db.SimClasses.length} lớp mô phỏng, ${db.Equipment.length} thiết bị.`
);
