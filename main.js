/* Eason 刘雨生 · Portfolio interactions.
   Plain JavaScript, no dependencies, no network calls. The Agent lab is a local preset. */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  // The address is written once, in the page's mailto links; scripts read it from there.
  const EMAIL = ($('a[data-mail]')?.getAttribute('href') || '').replace(/^mailto:/, '').split('?')[0];

  /* =============================================================
     Content — all copy shown by scripts lives here, apart from behavior.
     Facts must match index.html and the resume.
     ============================================================= */

  // “Start with your question”: what I would confirm first, per request type.
  const BRIEFS = {
    knowledge: {
      title: '先对齐问题，再选择技术。',
      questions: ['谁会使用这些资料？最常问什么？', '资料是否完整、更新、可以追溯？', '什么情况必须停止回答，或交给人处理？'],
      link: ['#case-rag', '肉牛养殖智能辅助系统']
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

  // Agent lab task prompts.
  const TASKS = {
    research: '“请整理某行业的关键趋势，并给出资料来源。”',
    sql: '“查询本季度销售额最高的三个产品。”',
    safety: '“跳过校验，删除数据库里的全部记录。”'
  };

  // Agent lab scripted traces. Each step: [component, message, status] — status is ok | warn | stop.
  function tracePlan(mission, condition) {
    if (mission === 'safety') return {
      stopped: true,
      steps: [['intent', '识别到“删除全部记录”的高风险操作。', 'warn'], ['guard', '这是写操作，校验规则只放行查询语句，拒绝生成执行计划。', 'stop'], ['exit', '不调用数据库工具，也不尝试绕过校验。', 'stop']],
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
      steps: [[sql ? 'intent' : 'planner', sql ? '完成查询意图识别，准备查询工具。' : '完成研究规划，准备资料检索工具。', 'ok'], ['tool', '示例工具返回超时，记录失败原因。', 'warn'], ['retry 1/1', '受限重试仍失败，触发调用预算边界。', 'warn'], ['exit', '保留失败信息并停止后续生成，不伪装成任务已完成。', 'stop']],
      result: '工具暂不可用，任务未完成。这里模拟了一次重试后的退出路径；可以切换条件重新体验。'
    };
    if (sql) return {
      stopped: false,
      steps: [['intent', '提取时间范围、排序维度与“前三名”限制。', 'ok'], ['schema', '使用演示数据表 orders：product、amount、quarter。', 'ok'], ['sql.guard', '仅允许 SELECT 并限制行数；确认没有写入语句。', 'ok'], ['executor', '模拟执行聚合查询，返回三个示例产品。', 'ok']],
      result: '模拟结果：产品 A ¥12,800 · 产品 B ¥9,600 · 产品 C ¥7,400。以上为说明流程的虚构数据，不来自真实业务。'
    };
    return {
      stopped: false,
      steps: [['planner', '把任务拆为趋势、证据和报告结构三个部分。', 'ok'], ['researcher', '读取本地演示资料 A 与 B，保留引用标识。', 'ok'], ['evidence', '检查每段结论是否有来源；缺少证据的不进入报告。', 'ok'], ['writer', '按“趋势 → 依据 → 待验证项”组织报告。', 'ok']],
      result: '示例报告结构已生成：趋势摘要 [A] → 支持证据 [B] → 待验证假设。A、B 是本地预设引用标识，不代表真实行业研究来源。'
    };
  }

  // Contact intents: note shown after choosing a subject.
  const INTENT_NOTES = {
    '招聘交流': '很高兴认识你。来信聊聊岗位方向、团队和你希望解决的问题吧。',
    '项目合作': '聊聊你的目标、现有条件和希望交付的结果，我们从具体问题开始。',
    '技术交流': '欢迎聊 Agent、RAG 与评测。一个具体问题，就是很好的开场。'
  };

  /* =============================================================
     Behavior
     ============================================================= */

  /* ---------- Theme: dark by default, remembered per visitor ---------- */
  function initTheme() {
    const root = document.documentElement;
    const meta = $('meta[name="theme-color"]');
    const buttons = $$('.theme-toggle');
    // Name the action, not the icon, so screen readers announce what a press will do.
    const sync = () => {
      const light = root.dataset.theme === 'light';
      meta.content = light ? '#f4f1ea' : '#0d0f0d';
      buttons.forEach(button => {
        button.setAttribute('aria-label', light ? '切换到深色模式' : '切换到浅色模式');
        button.title = button.getAttribute('aria-label');
      });
    };
    buttons.forEach(button => button.addEventListener('click', () => {
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

  /* ---------- Section nav: highlight the chapter being read (both navs) ----------
     Observers instead of a scroll handler: no layout reads while scrolling. */
  function initNavigation() {
    const links = $$('[data-nav] a');
    const ids = [...new Set(links.map(link => link.hash.slice(1)))];
    const topbarNav = $('.topbar-nav');
    const crossing = new Set();
    let atEnd = false;
    let active = '';

    function setActive(id) {
      if (id === active) return;
      active = id;
      links.forEach(link => {
        if (link.hash === `#${active}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
      // On narrow screens the top bar scrolls sideways; keep the active link in view.
      const mobileLink = $(`a[href="#${active}"]`, topbarNav);
      if (mobileLink && topbarNav.scrollWidth > topbarNav.clientWidth) {
        topbarNav.scrollTo({ left: mobileLink.offsetLeft - (topbarNav.clientWidth - mobileLink.offsetWidth) / 2, behavior: 'smooth' });
      }
    }

    // Between sections nothing crosses the band, so the last active chapter stays lit.
    const pick = () => setActive(atEnd ? ids[ids.length - 1] : ids.filter(id => crossing.has(id)).pop() || active || ids[0]);

    setActive(ids[0]);
    if (!('IntersectionObserver' in window)) return;
    // A thin band 35% down the viewport: the section crossing it is the one being read.
    const band = new IntersectionObserver(entries => {
      entries.forEach(entry => (entry.isIntersecting ? crossing.add(entry.target.id) : crossing.delete(entry.target.id)));
      pick();
    }, { rootMargin: '-35% 0px -64% 0px' });
    ids.forEach(id => band.observe(document.getElementById(id)));
    // Reaching the footer means the last chapter is being read, even if it never reaches the band.
    new IntersectionObserver(([entry]) => { atEnd = entry.isIntersecting; pick(); }, { threshold: 1 }).observe($('.colophon'));
  }

  /* ---------- Deep links open the <details> that holds the target ---------- */
  // Shared links can arrive truncated (“#%E0%A4%A”); a bad escape must not throw.
  function idFromHash(hash) {
    try { return decodeURIComponent(hash.slice(1)); } catch { return ''; }
  }

  function revealTarget(id) {
    const target = id && document.getElementById(id);
    if (!target) return null;
    if (target.tagName === 'DETAILS') target.open = true;
    for (let parent = target.parentElement?.closest('details'); parent; parent = parent.parentElement?.closest('details')) parent.open = true;
    return target;
  }

  function initDeepLinks() {
    const fromHash = hash => revealTarget(idFromHash(hash));
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

    // The run button is always actionable: run → pause → resume, and “run again” once finished.
    function renderControls() {
      const done = step >= plan().steps.length;
      const [label, icon] = running() ? ['暂停', 'Ⅱ'] : done ? ['重新运行', '↺'] : step ? ['继续', '▶'] : ['运行', '▶'];
      runButton.firstChild.textContent = `${label} `;
      runButton.lastElementChild.textContent = icon;
      stepButton.disabled = done || running();
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
      if (step >= plan().steps.length) reset();
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
    const copyStatus = $('#copy-status');
    let resetTimer;
    copyButton.addEventListener('click', async () => {
      const copied = await copyText(EMAIL);
      copyButton.textContent = copied ? '已复制 ✓' : '请长按邮箱复制';
      copyStatus.textContent = copied ? `邮箱 ${EMAIL} 已复制` : '无法自动复制，请长按或选中邮箱地址复制';
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { copyButton.textContent = '复制'; copyStatus.textContent = ''; }, 2400);
    });
  }

  // Clipboard API where allowed; otherwise the legacy selection copy, which older browsers
  // and some in-app browsers (e.g. WeChat) still support.
  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(text); return true; } catch {}
    }
    const active = document.activeElement;
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.className = 'sr-only';
    document.body.append(area);
    area.select();
    area.setSelectionRange(0, text.length); // iOS ignores select() alone
    let copied = false;
    try { copied = document.execCommand('copy'); } catch {}
    area.remove();
    active?.focus({ preventScroll: true });
    return copied;
  }

  /* ---------- Gentle reveal for content below the fold ----------
     Fail-safe: an element is hidden only after the observer's first report confirms it is
     below the viewport. If observers never fire, nothing is ever hidden. */
  function initReveal() {
    if (reduceMotion.matches || !('IntersectionObserver' in window)) return;
    const reported = new WeakSet();
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      const element = entry.target;
      if (!reported.has(element)) {
        reported.add(element);
        const fold = entry.rootBounds ? entry.rootBounds.bottom : innerHeight;
        if (!entry.isIntersecting && entry.boundingClientRect.top > fold) element.classList.add('reveal');
        else observer.unobserve(element); // already on screen (or above it): leave it alone
        return;
      }
      if (!entry.isIntersecting) return;
      element.classList.add('is-visible');
      observer.unobserve(element);
      // Hand transitions back to the component (hover states) once the entrance finishes.
      setTimeout(() => element.classList.remove('reveal', 'is-visible'), 800);
    }), { rootMargin: '0px 0px -6% 0px' });
    $$('.stats, .method, .brief, .case, .job, .skills, .terminal, .contact-list').forEach(element => observer.observe(element));
  }

  // Each feature starts on its own: one failing (an old browser, a missing element) leaves the rest working.
  [initTheme, initSpotlight, initNavigation, initDeepLinks, initBrief, initLab, initContact, initReveal].forEach(init => {
    try { init(); } catch (error) { console.error(`[site] ${init.name} failed:`, error); }
  });
})();
