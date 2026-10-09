/**
 * The "create" row a creatable react-select offers for text that matches no
 * option; picking it calls `onCreateOption` with what was typed.
 */
export type CreateOption = { __isNew__: true; input: string };

export function toCreateOption(input: string): CreateOption {
  return { __isNew__: true, input };
}

export function isCreateOption(option: object): option is CreateOption {
  return "__isNew__" in option;
}
