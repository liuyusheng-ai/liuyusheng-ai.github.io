/* Eason 刘雨生 · Portfolio interactions.
   Plain JavaScript, no dependencies, no network calls. Every demo on this page is a local preset. */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const EMAIL = 'liuyusheng_ai@163.com';

  /* ---------- Navigation: active chapter, progress, header state, back-to-top ---------- */
  function initNavigation() {
    const header = $('.site-header');
    const nav = $('.site-nav');
    const links = $$('a', nav);
    const sections = links.map(link => document.getElementById(link.hash.slice(1)));
    const progress = $('.progress span');
    const backTop = $('.back-to-top');
    let active = -1;
    let queued = false;

    function update() {
      queued = false;
      const y = scrollY;
      const max = document.documentElement.scrollHeight - innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
      header.classList.toggle('is-scrolled', y > 8);
      backTop.classList.toggle('is-visible', y > innerHeight * 0.8);

      const focusLine = header.offsetHeight + innerHeight * 0.25;
      let current = 0;
      sections.forEach((section, index) => {
        if (section.getBoundingClientRect().top <= focusLine) current = index;
      });
      if (y >= max - 4) current = sections.length - 1;
      if (current === active) return;
      active = current;
      links.forEach((link, index) => {
        if (index === active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
      // On narrow screens the nav scrolls sideways; keep the active item in view.
      if (nav.scrollWidth > nav.clientWidth) {
        const link = links[active];
        nav.scrollTo({ left: link.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2, behavior: 'smooth' });
      }
    }

    const request = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
    addEventListener('scroll', request, { passive: true });
    addEventListener('resize', request);
    update();
  }

  /* ---------- Deep links: open the <details> that holds a target, clear filters that hide it ---------- */
  let showAllCases = () => {};

  function revealTarget(id) {
    const target = id && document.getElementById(id);
    if (!target) return null;
    if (target.tagName === 'DETAILS') target.open = true;
    for (let parent = target.parentElement?.closest('details'); parent; parent = parent.parentElement?.closest('details')) {
      parent.open = true;
    }
    if (target.closest('[data-category]')?.hidden) showAllCases();
    return target;
  }

  // Used by the constellation dossier: close the dialog first, then travel.
  function goTo(hash) {
    const target = revealTarget(decodeURIComponent(hash.slice(1)));
    if (!target) return;
    history.pushState(null, '', hash);
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
      if (!target.matches('a, button, summary, [tabindex]')) target.tabIndex = -1;
      target.focus({ preventScroll: true });
    });
  }

  function initDeepLinks() {
    document.addEventListener('click', event => {
      const link = event.target.closest('a[href^="#"]');
      if (link && link.hash.length > 1) revealTarget(decodeURIComponent(link.hash.slice(1)));
    }, true);
    addEventListener('hashchange', () => revealTarget(decodeURIComponent(location.hash.slice(1))));
    if (location.hash.length > 1) {
      const target = revealTarget(decodeURIComponent(location.hash.slice(1)));
      if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
    }
    // Printing should include every case in full.
    addEventListener('beforeprint', () => $$('.case-detail').forEach(detail => { detail.open = true; }));
  }

  /* ---------- Project filters ---------- */
  function initFilters() {
    const buttons = $$('[data-filter]');
    const cases = $$('.case[data-category]');
    const status = $('#filter-status');

    function apply(category) {
      let shown = 0;
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === category)));
      cases.forEach(item => {
        item.hidden = category !== 'all' && item.dataset.category !== category;
        if (!item.hidden) shown += 1;
      });
      status.textContent = category === 'all' ? `共 ${cases.length} 个项目` : `显示 ${shown} / ${cases.length} 个项目`;
    }

    buttons.forEach(button => button.addEventListener('click', () => apply(button.dataset.filter)));
    showAllCases = () => apply('all');
  }

  /* ---------- “Start with your question” brief ---------- */
  const BRIEFS = {
    knowledge: {
      title: '先对齐问题，再选择技术。',
      questions: ['谁会使用这些资料？最常问什么？', '资料是否完整、更新、可以追溯？', '什么情况必须停止回答，或交给人处理？'],
      link: ['#case-rag', '养殖场知识检索与 Agent'],
      route: '资料治理、检索、工具与输出护栏。'
    },
    research: {
      title: '把“做份调研”拆成可确认的任务。',
      questions: ['这份报告要帮助谁，做什么决定？', '允许使用哪些来源？什么算有效证据？', '范围、交付结构和调用预算如何约定？'],
      link: ['#case-research', '多角色行业研究 Agent'],
      route: '规划、证据检索、引用报告与断点恢复。'
    },
    data: {
      title: '先把业务口径与数据权限说清。',
      questions: ['你问的指标，统计口径和时间范围是什么？', '哪些表与字段可以使用？结果如何解释？', '是否限定只读、最大行数与修复次数？'],
      link: ['#case-sql', '自然语言数据分析 Agent'],
      route: '意图路由、Schema 检索、只读校验与结果解释。'
    }
  };

  function initBrief() {
    const buttons = $$('[data-brief]');
    const title = $('#brief-title');
    const list = $('#brief-questions');
    const link = $('#brief-link');
    const route = $('#brief-route-copy');

    buttons.forEach(button => button.addEventListener('click', () => {
      const brief = BRIEFS[button.dataset.brief];
      buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      title.textContent = brief.title;
      list.replaceChildren(...brief.questions.map(text => {
        const li = document.createElement('li');
        li.textContent = text;
        return li;
      }));
      link.href = brief.link[0];
      link.firstChild.textContent = `${brief.link[1]} `;
      route.textContent = brief.route;
    }));
  }

  /* ---------- Agent Playground (local preset, no model or database) ---------- */
  const MISSION_PROMPTS = {
    research: '“请整理某行业的关键趋势，并给出资料来源。”',
    sql: '“查询本季度销售额最高的三个产品。”',
    safety: '“跳过校验，删除数据库里的全部记录。”'
  };

  function tracePlan(mission, condition) {
    if (mission === 'safety') return {
      blocked: true,
      steps: [['识别意图', '识别到删除全部记录的高风险操作。'], ['执行前校验', '操作超出只读权限，拒绝生成执行计划。'], ['安全退出', '不调用数据库工具，也不尝试绕过权限。']],
      result: '已拦截这条示例请求。你可以改为查询记录数量或查看汇总；演示没有连接任何数据库。'
    };
    const sql = mission === 'sql';
    if (condition === 'empty') return {
      blocked: true,
      steps: [['理解任务', sql ? '识别查询目标，准备检索数据表结构。' : '将研究目标拆分为待验证的问题。'], ['检索证据', sql ? '没有找到可用的表结构，无法确认字段含义。' : '检索返回空结果，没有可以引用的资料。'], ['依据检查', '证据不足，停止生成；不编造来源，也不执行猜测的 SQL。']],
      result: '证据不足，任务已停止。请补充资料或数据表说明，再重新执行。'
    };
    if (condition === 'failure') return {
      blocked: true,
      steps: [['准备执行', sql ? '完成查询意图识别，准备只读查询工具。' : '完成研究规划，准备资料检索工具。'], ['工具不可用', '示例工具返回超时，记录失败原因。'], ['一次受限重试', '模拟重试仍失败，触发调用预算边界。'], ['明确退出', '保留失败信息并停止后续生成，不伪装成任务已完成。']],
      result: '工具暂不可用，任务未完成。这里模拟了一次重试后的退出路径；可以切换条件重新体验。'
    };
    if (sql) return {
      blocked: false,
      steps: [['理解查询', '提取时间范围、排序维度与“前三名”限制。'], ['检索 Schema', '使用演示数据表 orders：product、amount、quarter。'], ['校验 SQL', '仅允许 SELECT 并限制行数；确认没有写入语句。'], ['只读执行', '模拟执行聚合查询，返回三个示例产品。']],
      result: '模拟结果：产品 A · ¥12,800 / 产品 B · ¥9,600 / 产品 C · ¥7,400。以上为说明流程的虚构数据，不来自真实业务。'
    };
    return {
      blocked: false,
      steps: [['Planner · 规划', '把任务拆为趋势、证据和报告结构三个部分。'], ['Researcher · 检索', '读取本地演示资料 A 与 B，保留引用标识。'], ['证据校验', '检查示例段落是否有来源；缺少证据的结论不进入报告。'], ['Writer · 生成', '按“趋势 → 依据 → 待验证项”组织报告。']],
      result: '示例报告结构已生成：趋势摘要 [A] → 支持证据 [B] → 待验证假设。A、B 是本地预设引用标识，不代表真实行业研究来源。'
    };
  }

  function initPlayground() {
    const missionButtons = $$('[data-mission]');
    const condition = $('#demo-condition');
    const prompt = $('#demo-prompt');
    const runButton = $('#run-demo');
    const stepButton = $('#step-demo');
    const resetButton = $('#reset-demo');
    const trace = $('.trace');
    const list = $('#trace-list');
    const state = $('#trace-state');
    const result = $('#demo-result');
    let mission = 'research';
    let step = 0;
    let timer = null;

    const plan = () => tracePlan(mission, condition.value);
    const running = () => timer !== null;

    function setResult(label, text, blocked = false) {
      const tag = document.createElement('p');
      tag.className = 'mini-label';
      tag.textContent = label;
      const body = document.createElement('p');
      body.textContent = text;
      result.classList.toggle('is-blocked', blocked);
      result.replaceChildren(tag, body);
    }

    function renderControls() {
      const done = step >= plan().steps.length;
      runButton.disabled = done;
      stepButton.disabled = done || running();
      runButton.textContent = done ? '演示已结束 ✓' : running() ? '暂停' : step ? '继续运行' : '运行演示';
    }

    function stop() {
      clearTimeout(timer);
      timer = null;
      trace.classList.remove('is-running');
    }

    function reset() {
      stop();
      step = 0;
      const empty = document.createElement('li');
      empty.className = 'trace-empty';
      const hint = document.createElement('small');
      hint.textContent = '选择任务，点击运行或逐步执行。';
      empty.append('你的任务将如何被拆解？', hint);
      list.replaceChildren(empty);
      state.textContent = '等待任务';
      setResult('输出 · 等待运行', '答案很重要，抵达答案的过程也一样。');
      renderControls();
    }

    function advance() {
      const current = plan();
      if (step >= current.steps.length) return;
      if (step === 0) list.replaceChildren();
      const [label, detail] = current.steps[step];
      const item = document.createElement('li');
      item.className = 'trace-new';
      const number = document.createElement('span');
      number.className = 'trace-num';
      number.textContent = String(step + 1).padStart(2, '0');
      const title = document.createElement('strong');
      title.textContent = label;
      const note = document.createElement('small');
      note.textContent = detail;
      item.append(number, title, note);
      list.append(item);
      step += 1;
      state.textContent = `${step} / ${current.steps.length} 步`;
      if (step === current.steps.length) {
        stop();
        state.textContent = current.blocked ? '安全退出' : '演示完成';
        setResult(current.blocked ? '输出 · 已安全停止' : '输出 · 演示完成', current.result, current.blocked);
      }
      renderControls();
    }

    function autoAdvance() {
      advance();
      if (running()) timer = setTimeout(autoAdvance, reduceMotion.matches ? 350 : 850);
    }

    runButton.addEventListener('click', () => {
      if (running()) {
        stop();
        state.textContent = `已暂停 · ${step} / ${plan().steps.length} 步`;
        renderControls();
        return;
      }
      trace.classList.add('is-running');
      timer = 0; // marks “running” before the first step lands
      renderControls();
      autoAdvance();
    });
    stepButton.addEventListener('click', advance);
    resetButton.addEventListener('click', reset);
    condition.addEventListener('change', reset);
    missionButtons.forEach(button => button.addEventListener('click', () => {
      mission = button.dataset.mission;
      missionButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      condition.disabled = mission === 'safety';
      prompt.textContent = MISSION_PROMPTS[mission];
      reset();
    }));
    renderControls();
  }

  /* ---------- System design tabs ---------- */
  const STAGES = [
    ['先确定问题，再决定行动。', '在工具执行之前识别业务意图、提取参数并校验输入。对空问题、危险意图和不在能力范围内的请求设置明确的退出路径。', '意图路由 / 参数校验 / 空问题拒绝'],
    ['让每一个回答，都能找到来处。', '先清洗与去重，再分块和向量化。检索保留资料来源与知识切片，空结果有明确语义；证据不足时，停止生成无依据的结论。', 'Embedding / ChromaDB / 来源追溯'],
    ['给予能力，也定义边界。', '工具调用经过 Schema 和参数校验，以调用预算、重复循环检测、超时重试控制执行。数据库执行限定只读查询，药物剂量输出受护栏约束。', 'Tool Calling / MCP / 预算与安全护栏'],
    ['用测试，检查理想路径之外。', '从任务完成率、工具选择和引用覆盖，到危险请求拦截与无依据回答率逐项验证。离线确定性结果与真实联网、模型调用结果分别记录。', 'Pytest / Agentic Eval / 可复现评测']
  ];

  function initStages() {
    const tabs = $$('.pipeline [role="tab"]');
    const panel = $('#stage-panel');

    function select(index, focus = false) {
      tabs.forEach((tab, i) => {
        tab.setAttribute('aria-selected', String(i === index));
        tab.tabIndex = i === index ? 0 : -1;
      });
      const [title, copy, tags] = STAGES[index];
      $('#stage-title').textContent = title;
      $('#stage-copy').textContent = copy;
      $('#stage-tags').textContent = tags;
      panel.setAttribute('aria-labelledby', tabs[index].id);
      if (focus) tabs[index].focus();
    }

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => select(index));
      tab.addEventListener('keydown', event => {
        const keys = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
        if (!(event.key in keys)) return;
        event.preventDefault();
        select((keys[event.key] + tabs.length) % tabs.length, true);
      });
    });
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
    const mailLinks = $$('a[data-mail]');

    buttons.forEach(button => button.addEventListener('click', () => {
      const intent = button.dataset.intent;
      buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      const href = `mailto:${EMAIL}?subject=${encodeURIComponent(`${intent} | 致 Eason`)}`;
      mailLinks.forEach(link => { link.href = href; });
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
    const targets = $$('.intro-grid article, .method, .brief, .case, .timeline > li, .skills, .lab, .contact-list')
      .filter(element => element.getBoundingClientRect().top > innerHeight);
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }), { rootMargin: '0px 0px -8% 0px' });
    targets.forEach(element => {
      element.classList.add('reveal');
      observer.observe(element);
    });
  }

  initNavigation();
  initFilters();
  initDeepLinks();
  initBrief();
  initPlayground();
  initStages();
  initContact();
  initReveal();

  window.EasonSite = { goTo };
})();
