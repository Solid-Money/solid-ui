import { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { format, isToday } from 'date-fns';
import { CircleCheck, Layers, TriangleAlert, X } from 'lucide-react-native';

import { HERO_EXIT, HeroExit } from '@/components/Card/NewCardDetails/heroMotion';
import CardBottomSheet from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet';
import { sheetBodyInset } from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet.types';
import SheetIconButton from '@/components/Card/NewCardDetails/SpendMode/SheetIconButton';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useKnownIncidents } from '@/hooks/useKnownIncidents';
import { track } from '@/lib/analytics';
import { IncidentNotice, incidentNotice, liveIncidentIds } from '@/lib/utils/incidentNotice';
import { useIncidentNoticeStore } from '@/store/useIncidentNoticeStore';
import { openSupportDrawer } from '@/store/useSupportDrawerStore';

import type { KnownIncident } from '@/lib/api/incidents';

const AMBER = '#FFC852';
const GREEN = '#94F27F';

/** Figma "Outage notice — known incidents": the sheet body starts 24 below its top edge. */
const SHEET_TOP = 24;
const SHEET_BOTTOM = 32;

/** Long enough for the sheet to finish closing before the support drawer rises. */
const SUPPORT_HANDOFF_MS = 300;

const timeLabel = (value: string | null): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return isToday(date) ? format(date, 'h:mm a') : format(date, 'MMM d, h:mm a');
};

const toneOf = (notice: IncidentNotice) =>
  notice.kind === 'single' && notice.tone === 'resolved' ? GREEN : AMBER;

/** Title and message on the Home card. */
const bannerCopy = (notice: IncidentNotice): { title: string; message: string } => {
  if (notice.kind === 'multiple') {
    return {
      title: `${notice.incidents.length} known issues`,
      message: notice.incidents.map(incident => incident.title).join(' · '),
    };
  }
  if (notice.tone === 'resolved') {
    const fixedAt = timeLabel(notice.incident.resolvedAt);
    return {
      title: notice.incident.title,
      message: `${fixedAt ? `Fixed at ${fixedAt}` : 'Fixed'}. Thanks for bearing with us.`,
    };
  }
  return { title: notice.incident.title, message: notice.incident.message };
};

/** "Started 2:10 PM · Updated 2:41 PM", or when it was fixed. */
const timesLine = (incident: KnownIncident): string => {
  if (!incident.active) {
    const fixedAt = timeLabel(incident.resolvedAt);
    return fixedAt ? `Fixed at ${fixedAt}` : 'Fixed';
  }
  const started = timeLabel(incident.startedAt);
  const updated = timeLabel(incident.updatedAt);
  return [started && `Started ${started}`, updated && updated !== started && `Updated ${updated}`]
    .filter(Boolean)
    .join(' · ');
};

const NoticeIcon = ({ notice, size }: { notice: IncidentNotice; size: number }) => {
  const color = toneOf(notice);
  if (notice.kind === 'multiple') return <Layers size={size} color={color} />;
  if (notice.tone === 'resolved') return <CircleCheck size={size} color={color} />;
  return <TriangleAlert size={size} color={color} />;
};

const Pill = ({ label, color }: { label: string; color: string }) => (
  <View style={[styles.pill, { backgroundColor: color === GREEN ? PILL_GREEN : PILL_AMBER }]}>
    <Text className="text-[10px] font-semibold leading-[13px]" style={{ color }}>
      {label}
    </Text>
  </View>
);

/**
 * The Home notice for a known incident: an outage or a delay the team has
 * posted (Portal › Support › Settings, or the Solid Support connector).
 * Figma: Solid › UI 4 › "Outage notice — known incidents".
 *
 * Tapping it opens the full notice (`IncidentNoticeSheet`); × hides it until
 * the next update. Renders nothing when there is no incident, which is nearly
 * always, and nothing when the check fails: it never stands between the user
 * and Home.
 */
const HomeIncidentNotice = ({ className }: { className?: string }) => {
  const { data: incidents } = useKnownIncidents();
  const dismissed = useIncidentNoticeStore(state => state.dismissed);
  const seen = useIncidentNoticeStore(state => state.seen);
  const dismiss = useIncidentNoticeStore(state => state.dismiss);
  const markSeen = useIncidentNoticeStore(state => state.markSeen);
  const openSheet = useIncidentNoticeStore(state => state.openSheet);

  const notice = useMemo(
    () => incidentNotice(incidents ?? [], { dismissed, seen }),
    [incidents, dismissed, seen],
  );

  const liveIds = liveIncidentIds(notice).join(',');
  useEffect(() => {
    if (liveIds) markSeen(liveIds.split(','));
  }, [liveIds, markSeen]);

  if (!notice) return null;

  const tone = toneOf(notice);
  const { title, message } = bannerCopy(notice);
  const pill =
    notice.kind === 'single' && notice.tone === 'update'
      ? 'Update'
      : notice.kind === 'single' && notice.tone === 'resolved'
        ? 'Fixed'
        : null;

  const open = () => {
    track(TRACKING_EVENTS.INCIDENT_NOTICE_OPENED, { keys: notice.keys });
    openSheet(notice);
  };
  const close = () => {
    track(TRACKING_EVENTS.INCIDENT_NOTICE_DISMISSED, { keys: notice.keys });
    dismiss(notice.keys);
  };

  return (
    <HeroExit spec={HERO_EXIT.balance} className={className}>
      <View
        style={[styles.banner, { backgroundColor: tone === GREEN ? BANNER_GREEN : BANNER_AMBER }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title}. ${message}`}
          accessibilityHint="Opens the full notice"
          onPress={open}
          style={styles.content}
        >
          <View style={styles.icon}>
            <NoticeIcon notice={notice} size={18} />
          </View>
          <View style={styles.text}>
            <View style={styles.titleRow}>
              <Text
                numberOfLines={1}
                className="shrink text-[14px] font-semibold leading-[18px]"
                style={{ color: tone }}
              >
                {title}
              </Text>
              {pill && <Pill label={pill} color={tone} />}
            </View>
            <Text numberOfLines={2} className="text-[13px] leading-[17px] text-white/80">
              {message}
            </Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close notice"
          hitSlop={12}
          onPress={close}
          style={styles.close}
        >
          <X size={14} color="rgba(255,255,255,0.5)" />
        </Pressable>
      </View>
    </HeroExit>
  );
};

/**
 * The full notice: each incident's title, times and message, and a way to
 * reach support. Mounted beside the screen rather than inside the card, so it
 * can finish closing after the card is gone.
 */
export const IncidentNoticeSheet = () => {
  const notice = useIncidentNoticeStore(state => state.sheetNotice);
  const isOpen = useIncidentNoticeStore(state => state.isSheetOpen);
  const setSheetOpen = useIncidentNoticeStore(state => state.setSheetOpen);
  const dismiss = useIncidentNoticeStore(state => state.dismiss);
  const handoff = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (handoff.current) clearTimeout(handoff.current);
    },
    [],
  );

  if (!notice) return null;
  const incidents = notice.kind === 'multiple' ? notice.incidents : [notice.incident];
  const resolved = notice.kind === 'single' && notice.tone === 'resolved';

  const gotIt = () => {
    dismiss(notice.keys);
    setSheetOpen(false);
  };
  const chat = () => {
    track(TRACKING_EVENTS.INCIDENT_NOTICE_CHAT_PRESSED, { keys: notice.keys });
    setSheetOpen(false);
    handoff.current = setTimeout(() => openSupportDrawer(), SUPPORT_HANDOFF_MS);
  };

  return (
    <CardBottomSheet
      isOpen={isOpen}
      onOpenChange={setSheetOpen}
      contentKey="incident-notice"
      designTop={SHEET_TOP}
      designBottom={SHEET_BOTTOM}
    >
      {({ topPadding, presentation }) => (
        <View
          style={[
            styles.sheet,
            { paddingTop: topPadding, paddingHorizontal: sheetBodyInset(presentation) },
          ]}
        >
          <View style={styles.sheetHeader}>
            <View
              style={[
                styles.sheetIcon,
                { backgroundColor: resolved ? ICON_TILE_GREEN : ICON_TILE_AMBER },
              ]}
            >
              <NoticeIcon notice={notice} size={26} />
            </View>
            {presentation === 'modal' && (
              <SheetIconButton
                icon="close"
                accessibilityLabel="Close"
                onPress={() => setSheetOpen(false)}
              />
            )}
          </View>

          {incidents.map((incident, index) => (
            <View key={incident.id} style={[styles.entry, index > 0 && styles.entryDivider]}>
              <Text
                accessibilityRole="header"
                className="text-[24px] font-bold leading-[30px] text-white"
              >
                {incident.title}
              </Text>
              {!!timesLine(incident) && (
                <Text className="text-[13px] font-medium text-white/50">{timesLine(incident)}</Text>
              )}
              <Text className="mt-2 text-[15px] leading-[22px] text-white/80">
                {incident.active
                  ? incident.message
                  : 'This is fixed now. Thanks for bearing with us.'}
              </Text>
            </View>
          ))}

          <View style={styles.buttons}>
            <Button
              onPress={chat}
              accessibilityLabel="Chat with us"
              className="h-[54px] rounded-full bg-white"
            >
              <Text className="text-[16px] font-semibold text-[#111111]">Chat with us</Text>
            </Button>
            <Button
              variant="secondary"
              onPress={gotIt}
              accessibilityLabel="Got it"
              className="h-[54px] rounded-full border-0 bg-[#2A2A2A]"
            >
              <Text className="text-[16px] font-semibold text-white">Got it</Text>
            </Button>
          </View>
        </View>
      )}
    </CardBottomSheet>
  );
};

const BANNER_AMBER = 'rgba(255,200,82,0.12)';
const BANNER_GREEN = 'rgba(148,242,127,0.12)';
const PILL_AMBER = 'rgba(255,200,82,0.22)';
const PILL_GREEN = 'rgba(148,242,127,0.22)';
const ICON_TILE_AMBER = 'rgba(255,200,82,0.16)';
const ICON_TILE_GREEN = 'rgba(148,242,127,0.16)';

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 16,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 14,
    paddingRight: 10,
  },
  content: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  icon: { width: 18, height: 18 },
  text: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pill: { borderRadius: 100, paddingHorizontal: 6, paddingVertical: 2 },
  close: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  sheet: { gap: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  sheetIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entry: { gap: 6 },
  entryDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 16,
  },
  buttons: { gap: 10, paddingTop: 8 },
});

export default HomeIncidentNotice;
