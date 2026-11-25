import { NextResponse } from 'next/server';
import { z } from 'zod';
import { DomainError, type ActionName } from '@/core/mutations';
import { getCurrentUser } from '@/lib/auth';
import { runAction } from '@/lib/repository';

const ALLOWED_ACTIONS: ActionName[] = [
  'createSession',
  'updateSession',
  'cancelSession',
  'assignRoom',
  'createSwapRequest',
  'respondSwapRequest',
  'createSimClass',
  'reviewSimClass',
  'approveLateSimClass',
  'updateEquipment',
  'createEquipment',
  'reportIncident',
  'assessIncident',
  'confirmIncidentImpact',
  'closeIncident',
  'resolveEscalation',
  'runDailyChecks',
  'markNotificationsRead',
  'upsertUser',
  'upsertRoom',
  'upsertDepartment',
  'upsertTarget',
  'updateSetting',
  'updateVerificationLock',
  'generateRecurringMeetings',
];

const BodySchema = z.object({
  action: z.enum(ALLOWED_ACTIONS as [ActionName, ...ActionName[]]),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, code: 'UNAUTHORIZED', error: 'Vui lòng đăng nhập.' }, { status: 401 });
  }

  let parsed: z.infer<typeof BodySchema>;
  try {
    const raw = await request.json();
    parsed = BodySchema.parse(raw);
  } catch (err) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_BODY', error: 'Dữ liệu gửi lên không hợp lệ.', details: String(err) },
      { status: 400 }
    );
  }

  try {
    const data = await runAction(parsed.action, parsed.payload, user.email);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    if (err instanceof DomainError) {
      const status =
        err.code === 'FORBIDDEN'
          ? 403
          : err.code === 'NOT_FOUND'
            ? 404
            : err.code.includes('CONFLICT') || err.code === 'DUPLICATE'
              ? 409
              : 400;
      return NextResponse.json(
        { ok: false, code: err.code, error: err.message, details: err.details },
        { status }
      );
    }
    return NextResponse.json(
      { ok: false, code: 'INTERNAL_ERROR', error: err instanceof Error ? err.message : 'Lỗi máy chủ.' },
      { status: 500 }
    );
  }
}
