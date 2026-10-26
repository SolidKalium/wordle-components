// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HintText } from '../src/ui/html/components/Tooltip.jsx';

afterEach(cleanup);

const renderHint = () => render(<HintText tip="Helpful tip">Label</HintText>);

describe('HintText', () => {
  it('opens on keyboard focus and closes on Escape', async () => {
    renderHint();
    const trigger = screen.getByText('Label');
    expect(trigger.tabIndex).toBe(0);

    await act(async () => {
      trigger.focus();
      fireEvent.focus(trigger);
    });
    expect(screen.getByRole('tooltip').textContent).toBe('Helpful tip');

    await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }); });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('toggles on tap', async () => {
    renderHint();
    const trigger = screen.getByText('Label');
    const tap = async () => {
      await act(async () => {
        fireEvent.pointerDown(trigger, { pointerType: 'touch' });
        fireEvent.click(trigger);
      });
    };

    await tap();
    expect(screen.getByRole('tooltip')).toBeTruthy();
    await tap();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
