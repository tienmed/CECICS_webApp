@echo off
REM =========================================================================
REM CECICS Clinical Simulation Weekly Digest - Headless Runner
REM Tự động kích hoạt lúc 8:00 AM sáng Thứ 7 hàng tuần
REM =========================================================================
cd /d "E:\CECICS_webApp"
call npx tsx scripts/simulation_digest_cron.ts >> "public\digests\digest_cron.log" 2>&1
