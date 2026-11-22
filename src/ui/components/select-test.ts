import { expect, userEvent, waitFor } from 'storybook/test';

async function openOptions(combobox: HTMLElement): Promise<HTMLElement[]> {
  if (combobox.getAttribute('aria-expanded') !== 'true') {
    await userEvent.click(combobox);
  }
  const listId = combobox.getAttribute('aria-controls');
  const list = listId === null ? null : document.getElementById(listId);
  if (list === null) throw new Error('The listbox did not open');
  return [...list.querySelectorAll<HTMLElement>('[role="option"]')];
}

export async function optionTexts(combobox: HTMLElement): Promise<string[]> {
  const texts = (await openOptions(combobox)).map(
    (option) => option.textContent,
  );
  await userEvent.keyboard('{Escape}');
  return texts;
}

export async function chooseOption(
  combobox: HTMLElement,
  textOrValue: string,
): Promise<void> {
  const options = await openOptions(combobox);
  const option = options.find(
    (candidate) =>
      candidate.textContent === textOrValue ||
      candidate.dataset.value === textOrValue,
  );
  if (option === undefined) throw new Error(`No option ${textOrValue}`);
  await userEvent.click(option);
}

export async function waitForOption(
  combobox: () => HTMLElement,
  text: string,
): Promise<void> {
  await waitFor(async () => {
    await expect(await optionTexts(combobox())).toContain(text);
  });
}

export async function expectValue(
  combobox: HTMLElement,
  value: string,
): Promise<void> {
  await expect(combobox).toHaveAttribute('data-value', value);
}
