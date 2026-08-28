import type { Directive } from 'vue';

const tooltipId = 'flowtrace-tooltip';
const gap = 8;
const viewportPadding = 10;

type TooltipState = {
  cleanup: () => void;
  focused: boolean;
  hovered: boolean;
  originalDescribedBy: string | null;
  text: string;
};

type TooltipElement = HTMLElement & {
  __flowtraceTooltip?: TooltipState;
};

let activeElement: TooltipElement | undefined;
let tooltipSurface: HTMLDivElement | undefined;
let animationFrame: number | undefined;
let globalListenersReady = false;

function ensureSurface() {
  if (tooltipSurface) return tooltipSurface;

  tooltipSurface = document.createElement('div');
  tooltipSurface.id = tooltipId;
  tooltipSurface.className = 'app-tooltip-surface';
  tooltipSurface.dataset.state = 'closed';
  tooltipSurface.setAttribute('role', 'tooltip');
  document.body.append(tooltipSurface);

  if (!globalListenersReady) {
    const dismiss = () => activeElement && hideTooltip(activeElement);
    document.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    globalListenersReady = true;
  }

  return tooltipSurface;
}

function positionSurface(element: HTMLElement, surface: HTMLDivElement) {
  const anchor = element.getBoundingClientRect();
  const tooltip = surface.getBoundingClientRect();
  const centeredLeft = anchor.left + anchor.width / 2 - tooltip.width / 2;
  const left = Math.min(
    Math.max(centeredLeft, viewportPadding),
    window.innerWidth - tooltip.width - viewportPadding,
  );
  const fitsAbove = anchor.top >= tooltip.height + gap + viewportPadding;
  const top = fitsAbove
    ? anchor.top - tooltip.height - gap
    : anchor.bottom + gap;

  surface.dataset.placement = fitsAbove ? 'top' : 'bottom';
  surface.style.left = `${Math.round(left)}px`;
  surface.style.top = `${Math.round(top)}px`;
}

function showTooltip(element: TooltipElement) {
  const state = element.__flowtraceTooltip;
  if (!state?.text) return;

  if (activeElement && activeElement !== element) hideTooltip(activeElement);
  activeElement = element;

  const surface = ensureSurface();
  surface.textContent = state.text;
  surface.dataset.state = 'measuring';
  element.setAttribute(
    'aria-describedby',
    [state.originalDescribedBy, tooltipId].filter(Boolean).join(' '),
  );
  positionSurface(element, surface);

  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(() => {
    if (activeElement !== element) return;
    positionSurface(element, surface);
    surface.dataset.state = 'open';
  });
}

function hideTooltip(element: TooltipElement) {
  if (activeElement !== element) return;

  const state = element.__flowtraceTooltip;
  if (state?.originalDescribedBy) {
    element.setAttribute('aria-describedby', state.originalDescribedBy);
  } else {
    element.removeAttribute('aria-describedby');
  }

  activeElement = undefined;
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = undefined;
  if (tooltipSurface) tooltipSurface.dataset.state = 'closed';
}

function tooltipText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export const tooltip: Directive<TooltipElement, string | undefined> = {
  mounted(element, binding) {
    const onMouseEnter = () => {
      const state = element.__flowtraceTooltip;
      if (!state) return;
      state.hovered = true;
      showTooltip(element);
    };
    const onMouseLeave = () => {
      const state = element.__flowtraceTooltip;
      if (!state) return;
      state.hovered = false;
      if (!state.focused) hideTooltip(element);
    };
    const onFocus = () => {
      const state = element.__flowtraceTooltip;
      if (!state) return;
      state.focused = true;
      showTooltip(element);
    };
    const onBlur = () => {
      const state = element.__flowtraceTooltip;
      if (!state) return;
      state.focused = false;
      if (!state.hovered) hideTooltip(element);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hideTooltip(element);
    };

    element.__flowtraceTooltip = {
      cleanup: () => {
        element.removeEventListener('mouseenter', onMouseEnter);
        element.removeEventListener('mouseleave', onMouseLeave);
        element.removeEventListener('focus', onFocus);
        element.removeEventListener('blur', onBlur);
        element.removeEventListener('keydown', onKeyDown);
      },
      focused: false,
      hovered: false,
      originalDescribedBy: element.getAttribute('aria-describedby'),
      text: tooltipText(binding.value),
    };

    element.addEventListener('mouseenter', onMouseEnter);
    element.addEventListener('mouseleave', onMouseLeave);
    element.addEventListener('focus', onFocus);
    element.addEventListener('blur', onBlur);
    element.addEventListener('keydown', onKeyDown);
  },
  updated(element, binding) {
    const state = element.__flowtraceTooltip;
    if (!state) return;
    state.text = tooltipText(binding.value);
    if (activeElement === element) {
      if (state.text) showTooltip(element);
      else hideTooltip(element);
    }
  },
  beforeUnmount(element) {
    hideTooltip(element);
    element.__flowtraceTooltip?.cleanup();
    delete element.__flowtraceTooltip;
  },
};
