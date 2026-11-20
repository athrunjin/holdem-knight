import type { Currency, SavedChargeRule, SettingsSection } from "@holdem-knight/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { GUEST_ORGANIZER_ID, repository } from ".";
import { GAME_CONFIGS_KEY, releaseGameConfigs } from "./game-configs";

const CHARGE_RULES_KEY = ["charge-rules"] as const;

/** The section of a game's settings each kind of config fills. */
export const SECTION_OF_KIND: Record<SavedChargeRule["kind"], SettingsSection> = {
  basics: "basics",
  table_fee: "tableFee",
  wage: "wage",
  rake: "rake",
};

/** Saved basic settings, table fee, wage and rake configs, all kinds together. */
export function useChargeRules() {
  return useQuery({ queryKey: CHARGE_RULES_KEY, queryFn: () => repository.chargeRules.list() });
}

type ChargeRuleFields = Pick<SavedChargeRule, "kind" | "rule"> & {
  /** The currency a table fee or wage is set in */
  readonly currency?: Currency;
};

export function newChargeRule(name: string, fields: ChargeRuleFields): SavedChargeRule {
  return {
    id: crypto.randomUUID(),
    organizerId: GUEST_ORGANIZER_ID,
    name,
    createdAt: Date.now(),
    ...fields,
  } as SavedChargeRule;
}

export function useSaveChargeRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rule: SavedChargeRule) =>
      repository.chargeRules.save({ ...rule, updatedAt: Date.now() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHARGE_RULES_KEY }),
  });
}

export function useRemoveChargeRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const rule = (await repository.chargeRules.list()).find((saved) => saved.id === id);
      if (rule) await releaseGameConfigs({ section: SECTION_OF_KIND[rule.kind], id });
      await repository.chargeRules.remove(id);
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: CHARGE_RULES_KEY }),
        queryClient.invalidateQueries({ queryKey: GAME_CONFIGS_KEY }),
      ]),
  });
}
