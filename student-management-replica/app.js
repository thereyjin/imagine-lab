const tabs = [...document.querySelectorAll('.tabs button')];
const cards = [...document.querySelectorAll('.student-card')];
const input = document.querySelector('#searchInput');
const countText = document.querySelector('#countText');
const empty = document.querySelector('#emptyState');
const toast = document.querySelector('#toast');
let currentTab = 'active';
let toastTimer;

function notify(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1300);
}

function render() {
  const term = input.value.trim().toLowerCase();
  let visible = 0;
  cards.forEach(card => {
    const textMatch = !term || card.dataset.name.toLowerCase().includes(term) || card.dataset.id.includes(term);
    const tabMatch = currentTab !== 'focus' || card.dataset.focus === 'true';
    const show = textMatch && tabMatch;
    card.classList.toggle('hidden', !show);
    if (show) visible += 1;
  });
  empty.classList.toggle('visible', visible === 0);
  countText.textContent = term || currentTab === 'focus' ? `${visible}条` : '965条';
}

tabs.forEach(tab => tab.addEventListener('click', () => {
  tabs.forEach(item => item.classList.remove('active'));
  tab.classList.add('active');
  currentTab = tab.dataset.tab;
  render();
}));

input.addEventListener('input', render);

document.querySelectorAll('.focus-button').forEach(button => {
  button.addEventListener('click', () => {
    const card = button.closest('.student-card');
    const focused = card.dataset.focus === 'true';
    card.dataset.focus = String(!focused);
    button.classList.toggle('focused', !focused);
    button.querySelector('.focus-label').textContent = focused ? '关注学生' : '取消关注';
    notify(focused ? '已取消关注' : '已关注学生');
    render();
  });
});

document.querySelectorAll('.detail-button').forEach(button => {
  button.addEventListener('click', () => notify(`正在查看 ${button.closest('.student-card').dataset.id}`));
});

document.querySelector('.agent-filter').addEventListener('click', () => notify('代理筛选'));
document.querySelector('.back').addEventListener('click', () => notify('返回上一页'));
