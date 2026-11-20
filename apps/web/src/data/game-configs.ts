import {
  type ConfigUse,
  type GameSettings,
  gameConfigsUsing,
  gameConfigWithout,
  type SavedGameConfig,
} from "@holdem-knight/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { GUEST_ORGANIZER_ID, repository } from ".";

export const GAME_CONFIGS_KEY = ["game-configs"] as const;
const CONFIGS_KEY = GAME_CONFIGS_KEY;

export function useGameConfigs() {
  return useQuery({ queryKey: CONFIGS_KEY, queryFn: () => repository.gameConfigs.list() });
}

export function newGameConfig(name: string, settings: GameSettings): SavedGameConfig {
  return {
    id: crypto.randomUUID(),
    organizerId: GUEST_ORGANIZER_ID,
    name,
    settings,
    createdAt: Date.now(),
  };
}

export function useSaveGameConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: SavedGameConfig) =>
      repository.gameConfigs.save({ ...config, updatedAt: Date.now() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONFIGS_KEY }),
  });
}

export function useRemoveGameConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repository.gameConfigs.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONFIGS_KEY }),
  });
}

/** Counts the game configs that follow a saved config or an odds table, to say so before it changes. */
export function useConfigFollowers() {
  const { data: configs = [] } = useGameConfigs();
  return (use: ConfigUse) => gameConfigsUsing(configs, use).length;
}

/**
 * Before a saved config or an odds table is deleted: the game configs that follow it take the
 * values it has now as their own (ADR 0038). They are saved first, so a delete that then fails
 * leaves every game config with the right values.
 */
export async function releaseGameConfigs(use: ConfigUse) {
  const configs = gameConfigsUsing(await repository.gameConfigs.list(), use);
  if (configs.length === 0) return;
  const library = {
    chargeRules: await repository.chargeRules.list(),
    insuranceRules: await repository.insuranceRules.list(),
    oddsTables: await repository.oddsTables.list(),
  };
  const updatedAt = Date.now();
  for (const config of configs) {
    await repository.gameConfigs.save({ ...gameConfigWithout(config, use, library), updatedAt });
  }
}
