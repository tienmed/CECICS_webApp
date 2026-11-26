import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getResearchProjects, upsertResearchProject, type ResearchProject } from '@/lib/research-projects';
import { getWeeklySimulationDigestData } from '@/lib/simulation-crawler';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const projects = getResearchProjects();
  const digestData = await getWeeklySimulationDigestData();

  return NextResponse.json({
    projects,
    conferences: digestData.conferences,
    articles: digestData.articles,
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as ResearchProject;
    if (!body.ten_de_tai || !body.chu_nhiem) {
      return NextResponse.json({ error: 'Tên đề tài và Chủ nhiệm đề tài là bắt buộc' }, { status: 400 });
    }

    if (!body.id) {
      const year = new Date().getFullYear();
      body.id = `DT-CECICS-${year}-${Date.now().toString().slice(-4)}`;
    }

    const updated = upsertResearchProject(body);
    return NextResponse.json({ success: true, project: body, projects: updated });
  } catch (err) {
    return NextResponse.json({ error: 'Dữ liệu không hợp lệ: ' + String(err) }, { status: 500 });
  }
}
