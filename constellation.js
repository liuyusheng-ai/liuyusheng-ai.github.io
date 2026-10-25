/* Knowledge constellation — an optional, local-only way to browse the profile.
   Auto-tours one topic every 3 s. Dragging, arrow keys or choosing a topic switches to manual browsing.
   Honors prefers-reduced-motion (static, no tour) and pauses while off-screen or hovered. */
(() => {
  'use strict';

  const root = document.querySelector('[data-orbit]');
  if (!root) return;

  const EMAIL = 'liuyusheng_ai@163.com';
  const TOPICS = {
    about: {
      index: '01 · Identity', shape: 'sphere',
      title: '你好，我是 Eason。',
      summary: '理解业务，清晰沟通，用工程与评测把 Agent 能力落地。',
      heading: '让智能，有据可循。',
      intro: 'Eason（刘雨生），北京建筑大学人工智能专业本科在读，预计 2027 年毕业，专业成绩前 10%。求职方向为 AI Agent / 大模型应用开发。',
      items: [
        ['我在做什么', '围绕 RAG、多角色 Agent、工具调用与后端工程，让模型能力进入真实业务。'],
        ['我的合作方式', '先听懂场景与需求，再把技术方案、取舍和边界讲清楚；资料有来源、工具有边界、结果有评测。']
      ],
      links: [['阅读完整介绍', '#approach'], ['下载简历', 'resume.docx']]
    },
    projects: {
      index: '02 · Selected work', shape: 'clusters',
      title: '三个项目，三种工程实践。',
      summary: '养殖场 RAG、多角色研究、Text-to-SQL，各自附有评测口径。',
      heading: '从知识，到可用的系统。',
      intro: '一段行业应用与两个开源示例上的个人二次开发。每个案例都写明了问题、个人实现与验证范围。',
      items: [
        ['01 · 养殖场知识检索与 Agent', '15 份资料、67 个可追溯知识切片；封装知识检索和疾病初筛工具，加入调用预算与输出护栏。', '#case-rag'],
        ['02 · 多角色行业研究 Agent', '新增 MCP 客户端、工具空结果语义、受限重试、断点恢复与可复现评测。', '#case-research'],
        ['03 · 自然语言数据分析 Agent', '重构 6 节点链路，加入只读校验、危险函数拦截和修复次数上限。', '#case-sql']
      ],
      links: [['浏览全部案例', '#work']]
    },
    skills: {
      index: '03 · Toolkit', shape: 'helix',
      title: '把能力串成一条完整链路。',
      summary: 'Python → RAG → LangGraph / MCP → 安全与评测。',
      heading: '从后端，到 Agent 工程。',
      intro: '技术栈围绕大模型应用的落地过程组织：数据与服务、知识与工具、工程与评测。',
      items: [
        ['编程与后端', 'Python、SQL、Django / DRF、FastAPI、Celery / Redis、SQLAlchemy、SQLite / PostgreSQL、RESTful API。'],
        ['大模型应用', 'Prompt Engineering、RAG、Embedding、ChromaDB、LangGraph、ReAct、Tool Calling、MCP、角色协作式 Agent。'],
        ['工程与评测', 'Pytest、Git、Agentic Eval；关注任务完成、工具选择、参数提取、引用覆盖、安全拦截与延迟。']
      ],
      links: [['查看技术栈', '#skills']]
    },
    journey: {
      index: '04 · Journey', shape: 'ribbon',
      title: '从数据治理，走向 Agent 工程。',
      summary: '北京建筑大学 · 北京国际大数据交易所 · 海南君威。',
      heading: '在真实问题中积累。',
      intro: '教育与实习经历按简历记录整理。',
      items: [
        ['2026.05 — 至今 · 海南君威投资有限公司', 'AI 软件开发辅助岗，远程 / 兼职。负责行业知识库、RAG 接口、Agent 工具链与工程验证。'],
        ['2026.05 — 2026.07 · 北京国际大数据交易所', '数据挖掘实习生。独立完成采集、清洗和交付流程，累计处理 1 万余条数据产品记录。'],
        ['2023.09 — 2027.06（预计）· 北京建筑大学', '人工智能专业本科在读，智能科学与技术学院，专业成绩前 10%。']
      ],
      links: [['查看完整经历', '#about'], ['下载简历', 'resume.docx']]
    },
    lab: {
      index: '05 · Playground', shape: 'knot',
      title: '别只看介绍，亲手运行一次。',
      summary: '选择任务，逐步观察规划、检索、执行与安全退出。',
      heading: '进入 Agent 实验室。',
      intro: '实验室用本地预设流程解释系统设计，无需账号，也不采集你的输入。',
      items: [
        ['研究任务', '观察 Planner、Researcher、Writer 如何衔接，以及引用如何进入报告。'],
        ['只读查询', '体验问题理解、Schema 检索、SQL 校验与模拟结果。'],
        ['失败与安全', '切换“证据不足”或“工具不可用”，观察系统如何明确停止，而不是伪装完成。']
      ],
      links: [['打开互动演示', '#playground']]
    },
    contact: {
      index: '06 · Let’s talk', shape: 'signal',
      title: '下一个问题，也许来自你。',
      summary: '开放 AI Agent / 大模型应用开发机会，也欢迎项目与技术交流。',
      heading: '一起做点真实的东西。',
      intro: '如果你在寻找 AI 开发者，或想聊一个具体项目，欢迎通过以下方式联系我。',
      items: [['电子邮箱', EMAIL], ['联系电话', '158 9355 8838'], ['GitHub', 'github.com/liuyusheng-ai']],
      links: [['写一封邮件', `mailto:${EMAIL}`], ['选择联系主题', '#contact']]
    }
  };
  const ORDER = Object.keys(TOPICS);
  const TOUR_MS = 3000;

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const topicButtons = [...root.querySelectorAll('[data-topic]')];
  const toggle = root.querySelector('.orbit-toggle');
  const status = root.querySelector('#orbit-status');
  const card = root.querySelector('.orbit-card');
  const progress = root.querySelector('.orbit-progress');
  const dossier = document.getElementById('dossier');

  let topic = 'about';
  let manual = false;          // user took control: no auto tour until they resume
  let paused = motion.matches; // tour paused by button or reduced motion
  let hovering = false;
  let elapsed = 0;

  /* ---------- Topic state ---------- */
  function selectTopic(key) {
    topic = key;
    const item = TOPICS[key];
    topicButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.topic === key)));
    card.querySelector('.orbit-index').textContent = item.index;
    card.querySelector('.orbit-title').textContent = item.title;
    card.querySelector('.orbit-summary').textContent = item.summary;
    elapsed = 0;
    morphTo(item.shape);
  }

  function renderMode() {
    const touring = !manual && !paused;
    status.textContent = manual ? '手动浏览' : touring ? '自动导览 · 3 秒' : '导览已暂停';
    toggle.textContent = touring ? '暂停' : '继续导览';
    toggle.setAttribute('aria-pressed', String(!touring));
    toggle.setAttribute('aria-label', touring ? '暂停自动导览' : '继续自动导览');
    // Announce topic changes only when the visitor drives them.
    card.setAttribute('aria-live', touring ? 'off' : 'polite');
    if (!touring) progress.style.transform = 'scaleX(0)';
  }

  function takeControl() {
    if (!manual) { manual = true; renderMode(); }
  }

  toggle.addEventListener('click', () => {
    if (manual || paused) { manual = false; paused = false; }
    else paused = true;
    elapsed = 0;
    renderMode();
  });
  topicButtons.forEach(button => button.addEventListener('click', () => { takeControl(); selectTopic(button.dataset.topic); }));
  root.addEventListener('pointerenter', () => { hovering = true; });
  root.addEventListener('pointerleave', () => { hovering = false; });

  /* ---------- Dossier dialog ---------- */
  let returnFocus = null;

  function travel(event, href) {
    event.preventDefault();
    dossier.close();
    window.EasonSite?.goTo(href);
  }

  function makeLink(label, href) {
    const link = document.createElement('a');
    link.className = 'text-link';
    link.href = href;
    if (href === 'resume.docx') {
      link.download = 'Eason-刘雨生-简历.docx';
      link.textContent = `${label} ↓`;
    } else {
      link.textContent = `${label} ${href.startsWith('#') ? '→' : '↗'}`;
      if (href.startsWith('#')) link.addEventListener('click', event => travel(event, href));
    }
    return link;
  }

  function openDossier() {
    takeControl();
    const item = TOPICS[topic];
    returnFocus = document.activeElement;

    const index = document.createElement('p');
    index.className = 'orbit-index';
    index.textContent = item.index;
    const heading = document.createElement('h2');
    heading.id = 'dossier-title';
    heading.textContent = item.heading;
    const intro = document.createElement('p');
    intro.textContent = item.intro;

    const list = document.createElement('ul');
    list.className = 'dossier-list';
    item.items.forEach(([title, copy, href]) => {
      const li = document.createElement('li');
      const strong = document.createElement('strong');
      strong.textContent = title;
      const p = document.createElement('p');
      p.textContent = copy;
      li.append(strong, p);
      if (href) li.append(makeLink('阅读案例', href));
      list.append(li);
    });

    const actions = document.createElement('div');
    actions.className = 'dossier-actions';
    item.links.forEach(([label, href]) => actions.append(makeLink(label, href)));

    const note = document.createElement('p');
    note.className = 'dossier-note';
    note.textContent = topic === 'lab'
      ? '流程与数据为预设演示，不调用真实模型或数据库。'
      : '内容整理自个人简历；离线确定性评测与真实模型效果分开说明。';

    document.getElementById('dossier-content').replaceChildren(index, heading, intro, list, actions, note);
    dossier.showModal();
    dossier.scrollTop = 0;
    document.body.classList.add('has-modal');
  }

  root.querySelector('.orbit-open').addEventListener('click', openDossier);
  dossier.querySelector('.dossier-close').addEventListener('click', () => dossier.close());
  dossier.addEventListener('click', event => { if (event.target === dossier) dossier.close(); });
  dossier.addEventListener('close', () => {
    document.body.classList.remove('has-modal');
    if (returnFocus && root.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  });

  /* ---------- Particle field ---------- */
  if (!ctx) { canvas.hidden = true; return; }

  const TAU = Math.PI * 2;
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  const COUNT = innerWidth < 600 ? 760 : 1200;
  const points = Array.from({ length: COUNT }, (_, i) => ({ i, x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0 }));
  let width = 0, height = 0, angle = 0.3, tilt = 0.24, userAngle = 0, userTilt = 0, phase = 0;
  let settling = 0, dirty = true, inView = true, last = 0, drag = null;

  function shapePoint(kind, i) {
    const t = i / (COUNT - 1), a = i * GOLDEN;
    switch (kind) {
      case 'clusters': {
        const k = i % 3, j = Math.floor(i / 3), v = j / (COUNT / 3), y = 1 - 2 * v, r = Math.sqrt(Math.max(0, 1 - y * y)), theta = k * TAU / 3 - 0.5;
        return [Math.cos(theta) * 0.72 + Math.cos(j * GOLDEN) * r * 0.42, Math.sin(theta) * 0.72 + y * 0.42, Math.sin(j * GOLDEN) * r * 0.42];
      }
      case 'helix': {
        const half = COUNT / 2, t2 = (i % half) / (half - 1), theta = t2 * TAU * 2.7 + (i < half ? 0 : Math.PI), r = 0.56 + 0.13 * Math.cos(a);
        return [r * Math.cos(theta), (t2 - 0.5) * 2.4 + 0.08 * Math.sin(a), r * Math.sin(theta)];
      }
      case 'ribbon': {
        const theta = t * TAU * 2.2, band = Math.sin(a) * 0.28;
        return [(t - 0.5) * 2.5, Math.sin(theta) * 0.5 + band * Math.cos(theta), Math.cos(theta) * 0.5 + band * Math.sin(theta)];
      }
      case 'knot': {
        const u = t * TAU * 3, r = 0.73 + 0.28 * Math.cos(3 * u), tube = 0.13 * Math.sin(a);
        return [(r + tube) * Math.cos(2 * u), (r + tube) * Math.sin(2 * u), 0.36 * Math.sin(3 * u) + 0.13 * Math.cos(a)];
      }
      case 'signal': {
        const u = t * TAU * 3;
        return [(t - 0.5) * 2.4, Math.sin(u) * (0.28 + 0.25 * Math.sin(t * Math.PI)) + 0.12 * Math.cos(a), Math.cos(u) * 0.48 + 0.12 * Math.sin(a)];
      }
      default: { // sphere
        const y = 1 - 2 * t, r = Math.sqrt(Math.max(0, 1 - y * y)), ripple = 1.04 + 0.06 * Math.sin(a * 3) * Math.sin(y * 6);
        return [Math.cos(a) * r * ripple, y * ripple, Math.sin(a) * r * ripple];
      }
    }
  }

  function morphTo(kind) {
    points.forEach(p => {
      [p.tx, p.ty, p.tz] = shapePoint(kind, p.i);
      if (motion.matches) { p.x = p.tx; p.y = p.ty; p.z = p.tz; }
    });
    settling = motion.matches ? 1 : 54;
    dirty = true;
  }

  function project(x, y, z) {
    const ay = angle + userAngle, ax = tilt + userTilt;
    const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
    const xx = x * cy + z * sy;
    let zz = -x * sy + z * cy;
    const yy = y * cx - zz * sx;
    zz = y * sx + zz * cx;
    const perspective = 4.8 / (4.8 + zz), scale = Math.min(width * 0.27, height * 0.36);
    return [width / 2 + xx * scale * perspective, height * 0.5 + yy * scale * perspective, zz];
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    // A faint orbit ring anchors the figure without competing with the hero copy.
    ctx.strokeStyle = 'rgba(86, 112, 92, .09)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(width / 2, height / 2, Math.min(width * 0.36, height * 0.62), Math.min(width * 0.13, height * 0.2), -0.32, 0, TAU);
    ctx.stroke();

    const activeIndex = ORDER.indexOf(topic);
    const breathe = motion.matches ? 1 : 1 + 0.016 * Math.sin(phase);
    const projected = points.map(p => {
      if (settling > 0) { p.x += (p.tx - p.x) * 0.13; p.y += (p.ty - p.y) * 0.13; p.z += (p.tz - p.z) * 0.13; }
      const [sx, sy, sz] = project(p.x * breathe, p.y * breathe, p.z * breathe);
      return { sx, sy, sz, active: p.i % ORDER.length === activeIndex };
    }).sort((a, b) => b.sz - a.sz);

    for (const p of projected) {
      const alpha = Math.min(0.66, 0.12 + (1.5 - p.sz) * 0.18);
      ctx.fillStyle = p.active ? `rgba(150, 101, 63, ${alpha})` : `rgba(70, 96, 78, ${alpha * 0.85})`;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, p.active ? 1.05 : p.sz < 0 ? 0.85 : 0.6, 0, TAU);
      ctx.fill();
    }
    if (settling > 0) settling -= 1;
    dirty = false;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function tick(now) {
    const delta = Math.min(80, now - last);
    if (inView && !document.hidden && delta >= 32) {
      last = now;
      const touring = !manual && !paused && !motion.matches;
      if (!motion.matches && !drag) { angle += manual ? 0.0008 : 0.0016; phase += 0.018; dirty = true; }
      if (touring && !hovering && !dossier.open) {
        elapsed += delta;
        if (elapsed >= TOUR_MS) selectTopic(ORDER[(ORDER.indexOf(topic) + 1) % ORDER.length]);
        progress.style.transform = `scaleX(${(elapsed / TOUR_MS).toFixed(3)})`;
      }
      if (dirty || settling) draw();
    }
    requestAnimationFrame(tick);
  }

  /* ---------- Pointer and keyboard ---------- */
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, angle: userAngle, tilt: userTilt, from: ORDER.indexOf(topic), moved: false };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 6) { drag.moved = true; takeControl(); }
    if (!drag.moved) return;
    userAngle = drag.angle + dx * 0.009;
    userTilt = Math.max(-1.1, Math.min(1.1, drag.tilt + dy * 0.006));
    const next = ORDER[((drag.from + Math.round(dx / 70)) % ORDER.length + ORDER.length) % ORDER.length];
    if (next !== topic) selectTopic(next);
    dirty = true;
  });
  const endDrag = event => { if (drag?.id === event.pointerId) drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('dblclick', () => { userAngle = 0; userTilt = 0; dirty = true; });
  canvas.addEventListener('keydown', event => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (step) {
      takeControl();
      userAngle += step * 0.2;
      selectTopic(ORDER[(ORDER.indexOf(topic) + step + ORDER.length) % ORDER.length]);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      takeControl();
      userTilt = Math.max(-1.1, Math.min(1.1, userTilt + (event.key === 'ArrowUp' ? -0.15 : 0.15)));
    } else if (event.key === 'Enter' || event.key === ' ') {
      openDossier();
    } else return;
    event.preventDefault();
    dirty = true;
  });

  motion.addEventListener('change', () => { paused = motion.matches; renderMode(); morphTo(TOPICS[topic].shape); });
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; dirty = true; }).observe(canvas);

  points.forEach(p => { [p.x, p.y, p.z] = shapePoint('sphere', p.i); p.tx = p.x; p.ty = p.y; p.tz = p.z; });
  renderMode();
  resize();
  requestAnimationFrame(tick);
})();
