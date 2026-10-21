/**
 * An APY as a percent: one decimal ("5.5%"), two under 1% so a small rate is not
 * rounded away ("0.04%", where one decimal shows EUR Yield's 0.0365 as "0.0%").
 */
export const formatApyPercent = (apy: number) => `${apy.toFixed(apy > 0 && apy < 1 ? 2 : 1)}%`;
