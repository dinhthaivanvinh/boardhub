// Office activities the server can host. Adding an activity = one line here (ADR-0005, skill office-add-activity).
import type { AnyActivityDefinition } from '@bg/office-core';
import { activity as luckyAnimal } from '@bg/office-lucky-animal';

export const OFFICE_ACTIVITIES: Record<string, AnyActivityDefinition> = {
  'lucky-animal': luckyAnimal,
};
