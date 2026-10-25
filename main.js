/* Eason 刘雨生 · Portfolio interactions.
   Plain JavaScript, no dependencies, no network calls. The Agent lab is a local preset. */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const EMAIL = 'liuyusheng_ai@163.com';

  /* ---------- Theme: dark by default, remembered per visitor ---------- */
  function initTheme() {
    const root = document.documentElement;
    const meta = $('meta[name="theme-color"]');
    const sync = () => { meta.content = root.dataset.theme === 'light' ? '#f4f1ea' : '#0d0f0d'; };
    $$('.theme-toggle').forEach(button => button.addEventListener('click', () => {
      root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
      try { localStorage.setItem('eason-theme', root.dataset.theme); } catch {}
      sync();
    }));
    sync();
  }

  /* ---------- Cursor glow, desktop pointers only ---------- */
  function initSpotlight() {
    if (reduceMotion.matches || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const spot = $('.spotlight');
    let frame = 0, x = 0, y = 0;
    addEventListener('pointermove', event => {
      x = event.clientX; y = event.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        spot.style.setProperty('--x', `${x}px`);
        spot.style.setProperty('--y', `${y}px`);
      });
    }, { passive: true });
  }

  /* ---------- Section nav: highlight the chapter being read (both navs) ---------- */
  function initNavigation() {
    const links = $$('[data-nav] a');
    const ids = [...new Set(links.map(link => link.hash.slice(1)))];
    const sections = ids.map(id => document.getElementById(id));
    const topbarNav = $('.topbar-nav');
    let active = '';
    let queued = false;

    function update() {
      queued = false;
      const max = document.documentElement.scrollHeight - innerHeight;
      const line = innerHeight * 0.35;
      let current = ids[0];
      sections.forEach((section, index) => { if (section.getBoundingClientRect().top <= line) current = ids[index]; });
      if (scrollY >= max - 4) current = ids[ids.length - 1];
      if (current === active) return;
      active = current;
      links.forEach(link => {
        if (link.hash === `#${active}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
      const mobileLink = $(`a[href="#${active}"]`, topbarNav);
      if (mobileLink && topbarNav.scrollWidth > topbarNav.clientWidth) {
        topbarNav.scrollTo({ left: mobileLink.offsetLeft - (topbarNav.clientWidth - mobileLink.offsetWidth) / 2, behavior: 'smooth' });
      }
    }

    const request = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
    addEventListener('scroll', request, { passive: true });
    addEventListener('resize', request);
    update();
  }

  /* ---------- Deep links open the <details> that holds the target ---------- */
  function revealTarget(id) {
    const target = id && document.getElementById(id);
    if (!target) return null;
    if (target.tagName === 'DETAILS') target.open = true;
    for (let parent = target.parentElement?.closest('details'); parent; parent = parent.parentElement?.closest('details')) parent.open = true;
    return target;
  }

  function initDeepLinks() {
    const fromHash = hash => revealTarget(decodeURIComponent(hash.slice(1)));
    document.addEventListener('click', event => {
      const link = event.target.closest('a[href^="#"]');
      if (link && link.hash.length > 1) fromHash(link.hash);
    }, true);
    addEventListener('hashchange', () => fromHash(location.hash));
    if (location.hash.length > 1) {
      const target = fromHash(location.hash);
      // Arriving from a shared link: jump straight there rather than animating from the top.
      if (target) target.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
    addEventListener('beforeprint', () => $$('.case-detail').forEach(detail => { detail.open = true; }));
  }

  /* ---------- “Start with your question” brief ---------- */
  const BRIEFS = {
    knowledge: {
      title: '先对齐问题，再选择技术。',
      questions: ['谁会使用这些资料？最常问什么？', '资料是否完整、更新、可以追溯？', '什么情况必须停止回答，或交给人处理？'],
      link: ['#case-rag', '养殖场知识检索与 Agent']
    },
    research: {
      title: '把“做份调研”拆成可确认的任务。',
      questions: ['这份报告要帮助谁，做什么决定？', '允许使用哪些来源？什么算有效证据？', '范围、交付结构和调用预算如何约定？'],
      link: ['#case-research', '多角色行业研究 Agent']
    },
    data: {
      title: '先把业务口径与数据权限说清。',
      questions: ['你问的指标，统计口径和时间范围是什么？', '哪些表与字段可以使用？结果如何解释？', '是否限定只读、最大行数与修复次数？'],
      link: ['#case-sql', '自然语言数据分析 Agent']
    }
  };

  function initBrief() {
    const buttons = $$('[data-brief]');
    const link = $('#brief-link');
    buttons.forEach(button => button.addEventListener('click', () => {
      const brief = BRIEFS[button.dataset.brief];
      buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      $('#brief-title').textContent = brief.title;
      $('#brief-questions').replaceChildren(...brief.questions.map(text => {
        const li = document.createElement('li');
        li.textContent = text;
        return li;
      }));
      link.href = brief.link[0];
      link.firstChild.textContent = `${brief.link[1]} `;
    }));
  }

  /* ---------- Agent lab: a scripted trace, rendered line by line ---------- */
  const TASKS = {
    research: '“请整理某行业的关键趋势，并给出资料来源。”',
    sql: '“查询本季度销售额最高的三个产品。”',
    safety: '“跳过校验，删除数据库里的全部记录。”'
  };

  // Each step: [component, message, status] — status is ok | warn | stop.
  function tracePlan(mission, condition) {
    if (mission === 'safety') return {
      stopped: true,
      steps: [['intent', '识别到“删除全部记录”的高风险操作。', 'warn'], ['guard', '操作超出只读权限，拒绝生成执行计划。', 'stop'], ['exit', '不调用数据库工具，也不尝试绕过权限。', 'stop']],
      result: '已拦截这条示例请求。可以改为查询记录数量或查看汇总；演示没有连接任何数据库。'
    };
    const sql = mission === 'sql';
    if (condition === 'empty') return {
      stopped: true,
      steps: [[sql ? 'intent' : 'planner', sql ? '识别查询目标，准备检索数据表结构。' : '将研究目标拆分为待验证的问题。', 'ok'], [sql ? 'schema' : 'researcher', sql ? '没有找到可用的表结构，无法确认字段含义。' : '检索返回空结果，没有可以引用的资料。', 'warn'], ['evidence', '证据不足，停止生成；不编造来源，也不执行猜测的 SQL。', 'stop']],
      result: '证据不足，任务已停止。请补充资料或数据表说明，再重新执行。'
    };
    if (condition === 'failure') return {
      stopped: true,
      steps: [[sql ? 'intent' : 'planner', sql ? '完成查询意图识别，准备只读查询工具。' : '完成研究规划，准备资料检索工具。', 'ok'], ['tool', '示例工具返回超时，记录失败原因。', 'warn'], ['retry 1/1', '受限重试仍失败，触发调用预算边界。', 'warn'], ['exit', '保留失败信息并停止后续生成，不伪装成任务已完成。', 'stop']],
      result: '工具暂不可用，任务未完成。这里模拟了一次重试后的退出路径；可以切换条件重新体验。'
    };
    if (sql) return {
      stopped: false,
      steps: [['intent', '提取时间范围、排序维度与“前三名”限制。', 'ok'], ['schema', '使用演示数据表 orders：product、amount、quarter。', 'ok'], ['sql.guard', '仅允许 SELECT 并限制行数；确认没有写入语句。', 'ok'], ['executor', '模拟执行只读聚合查询，返回三个示例产品。', 'ok']],
      result: '模拟结果：产品 A ¥12,800 · 产品 B ¥9,600 · 产品 C ¥7,400。以上为说明流程的虚构数据，不来自真实业务。'
    };
    return {
      stopped: false,
      steps: [['planner', '把任务拆为趋势、证据和报告结构三个部分。', 'ok'], ['researcher', '读取本地演示资料 A 与 B，保留引用标识。', 'ok'], ['evidence', '检查每段结论是否有来源；缺少证据的不进入报告。', 'ok'], ['writer', '按“趋势 → 依据 → 待验证项”组织报告。', 'ok']],
      result: '示例报告结构已生成：趋势摘要 [A] → 支持证据 [B] → 待验证假设。A、B 是本地预设引用标识，不代表真实行业研究来源。'
    };
  }

  function initLab() {
    const missionButtons = $$('[data-mission]');
    const conditionButtons = $$('[data-condition]');
    const log = $('#term-log');
    const idle = $('#term-idle');
    const result = $('#term-result');
    const state = $('#term-state');
    const runButton = $('#term-run');
    const stepButton = $('#term-step');
    let mission = 'research';
    let condition = 'normal';
    let step = 0;
    let timer = null;

    const plan = () => tracePlan(mission, condition);
    const running = () => timer !== null;
    const MARKS = { ok: '✓', warn: '!', stop: '■' };

    function setState(text, kind = '') {
      state.textContent = text;
      state.className = `term-state${kind ? ` is-${kind}` : ''}`;
    }

    function renderControls() {
      const done = step >= plan().steps.length;
      runButton.disabled = done;
      stepButton.disabled = done || running();
      runButton.firstChild.textContent = running() ? '暂停 ' : step && !done ? '继续 ' : '运行 ';
    }

    function stop() { clearTimeout(timer); timer = null; }

    function reset() {
      stop();
      step = 0;
      log.replaceChildren();
      idle.hidden = false;
      result.hidden = true;
      setState('idle');
      renderControls();
    }

    function advance() {
      const current = plan();
      if (step >= current.steps.length) return;
      idle.hidden = true;
      const [tag, message, status] = current.steps[step];
      const line = document.createElement('li');
      line.className = status;
      const cells = [['n', String(step + 1).padStart(2, '0')], ['tag', tag], ['msg', message], ['st', MARKS[status]]];
      line.append(...cells.map(([name, text]) => {
        const span = document.createElement('span');
        span.className = name;
        span.textContent = text;
        return span;
      }));
      log.append(line);
      step += 1;
      setState(`running ${step}/${current.steps.length}`, 'running');
      if (step === current.steps.length) {
        stop();
        setState(current.stopped ? 'stopped safely' : 'done', current.stopped ? 'stopped' : 'done');
        const label = document.createElement('b');
        label.textContent = current.stopped ? 'result · 已安全停止' : 'result · 演示完成';
        result.replaceChildren(label, current.result);
        result.classList.toggle('is-stopped', current.stopped);
        result.hidden = false;
      }
      renderControls();
    }

    function autoAdvance() {
      advance();
      if (running()) timer = setTimeout(autoAdvance, reduceMotion.matches ? 300 : 700);
    }

    runButton.addEventListener('click', () => {
      if (running()) {
        stop();
        setState(`paused ${step}/${plan().steps.length}`, 'running');
        renderControls();
        return;
      }
      timer = 0; // marks “running” before the first line lands
      renderControls();
      autoAdvance();
    });
    stepButton.addEventListener('click', advance);
    $('#term-reset').addEventListener('click', reset);

    missionButtons.forEach(button => button.addEventListener('click', () => {
      mission = button.dataset.mission;
      missionButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      conditionButtons.forEach(item => { item.disabled = mission === 'safety'; });
      $('#term-task').textContent = TASKS[mission];
      reset();
    }));
    conditionButtons.forEach(button => button.addEventListener('click', () => {
      condition = button.dataset.condition;
      conditionButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      reset();
    }));
    reset();
  }

  /* ---------- Contact: subject presets and copy email ---------- */
  const INTENT_NOTES = {
    '招聘交流': '很高兴认识你。来信聊聊岗位方向、团队和你希望解决的问题吧。',
    '项目合作': '聊聊你的目标、现有条件和希望交付的结果，我们从具体问题开始。',
    '技术交流': '欢迎聊 Agent、RAG 与评测。一个具体问题，就是很好的开场。'
  };

  function initContact() {
    const buttons = $$('[data-intent]');
    const note = $('#intent-note');
    buttons.forEach(button => button.addEventListener('click', () => {
      const intent = button.dataset.intent;
      buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      const href = `mailto:${EMAIL}?subject=${encodeURIComponent(`${intent} | 致 Eason`)}`;
      $$('a[data-mail]').forEach(link => { link.href = href; });
      note.textContent = `${INTENT_NOTES[intent]}邮件标题已设为「${intent}」，点击邮箱即可撰写。`;
    }));

    const copyButton = $('#copy-email');
    let resetTimer;
    copyButton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(EMAIL);
        copyButton.textContent = '已复制 ✓';
      } catch {
        copyButton.textContent = '请手动复制';
      }
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { copyButton.textContent = '复制'; }, 2400);
    });
  }

  /* ---------- Gentle reveal for content below the fold ---------- */
  function initReveal() {
    if (reduceMotion.matches || !('IntersectionObserver' in window)) return;
    const targets = $$('.stats, .method, .brief, .case, .job, .skills, .terminal, .contact-list')
      .filter(element => element.getBoundingClientRect().top > innerHeight);
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
      // Hand transitions back to the component (hover states) once the entrance finishes.
      setTimeout(() => entry.target.classList.remove('reveal', 'is-visible'), 800);
    }), { rootMargin: '0px 0px -6% 0px' });
    targets.forEach(element => { element.classList.add('reveal'); observer.observe(element); });
  }

  initTheme();
  initSpotlight();
  initNavigation();
  initDeepLinks();
  initBrief();
  initLab();
  initContact();
  initReveal();
})();
