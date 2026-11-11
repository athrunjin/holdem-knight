import type { SavedChargeRule } from "@holdem-knight/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { GUEST_ORGANIZER_ID, repository } from ".";

const CHARGE_RULES_KEY = ["charge-rules"] as const;

/** Saved table fee and wage configs, both kinds together. */
export function useChargeRules() {
  return useQuery({ queryKey: CHARGE_RULES_KEY, queryFn: () => repository.chargeRules.list() });
}

type ChargeRuleFields = Pick<SavedChargeRule, "kind" | "rule">;

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
    mutationFn: (rule: SavedChargeRule) => repository.chargeRules.save(rule),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHARGE_RULES_KEY }),
  });
}

export function useRemoveChargeRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repository.chargeRules.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHARGE_RULES_KEY }),
  });
}
