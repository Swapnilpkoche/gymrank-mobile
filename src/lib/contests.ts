import { supabase } from './supabase';
import { fetchPublicProfile } from './userFollows';
import type {
  BracketMatchup,
  BracketRound,
  ContestGender,
  ContestLevel,
  ContestPeriod,
  ContestStatus,
  Nomination,
} from '../types/database';

type RawContestPeriodRow = {
  id: number;
  level: ContestLevel;
  gym_id: number | null;
  city_id: number | null;
  gender: ContestGender;
  nomination_start: string;
  nomination_end: string;
  voting_start: string;
  voting_end: string;
  status: ContestStatus;
  winner_id: number | null;
  parent_contest_period_id: number | null;
};

const CONTEST_COLUMNS =
  'id, level, gym_id, city_id, gender, nomination_start, nomination_end, voting_start, voting_end, status, winner_id, parent_contest_period_id';

function toContestPeriod(row: RawContestPeriodRow): ContestPeriod {
  return {
    id: row.id,
    level: row.level,
    gymId: row.gym_id,
    cityId: row.city_id,
    gender: row.gender,
    nominationStart: row.nomination_start,
    nominationEnd: row.nomination_end,
    votingStart: row.voting_start,
    votingEnd: row.voting_end,
    status: row.status,
    winnerId: row.winner_id,
    parentContestPeriodId: row.parent_contest_period_id,
  };
}

// A tie sends the ORIGINAL contest_period into 'runoff' status while a NEW
// child contest_period (parent_contest_period_id set) is where the actual
// runoff voting happens - this resolves to whichever of the two is "live"
// to show/act on. Once the runoff completes, resolve_gym_contest updates
// both rows in the same call, so re-fetching the parent at that point
// already reflects the final result.
export async function fetchCurrentContestForGym(
  gymId: number,
  gender: ContestGender
): Promise<ContestPeriod | null> {
  const { data, error } = await supabase
    .from('contest_periods')
    .select(CONTEST_COLUMNS)
    .eq('gym_id', gymId)
    .eq('gender', gender)
    .is('parent_contest_period_id', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const parent = toContestPeriod(data as RawContestPeriodRow);
  if (parent.status !== 'runoff') return parent;

  const { data: runoffData, error: runoffError } = await supabase
    .from('contest_periods')
    .select(CONTEST_COLUMNS)
    .eq('parent_contest_period_id', parent.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (runoffError) throw runoffError;
  if (!runoffData) return parent;

  const runoff = toContestPeriod(runoffData as RawContestPeriodRow);
  if (runoff.status !== 'completed') return runoff;

  const { data: freshParent, error: freshError } = await supabase
    .from('contest_periods')
    .select(CONTEST_COLUMNS)
    .eq('id', parent.id)
    .single();

  if (freshError) throw freshError;
  return toContestPeriod(freshParent as RawContestPeriodRow);
}

type RawNominationRow = {
  id: number;
  contest_period_id: number;
  user_id: string;
  primary_photo_url: string;
  extra_photo_urls: string[] | null;
  status: 'active' | 'withdrawn';
  entry_time: string;
  rank: number | null;
};

const NOMINATION_COLUMNS =
  'id, contest_period_id, user_id, primary_photo_url, extra_photo_urls, status, entry_time, rank';

// profiles RLS only exposes your own row or an active gym staff row, so a
// nominee's display info has to come through get_public_profile - same
// reason messages.ts and fetchFollowedUsers do this.
async function toNomination(row: RawNominationRow): Promise<Nomination> {
  const profile = await fetchPublicProfile(row.user_id);
  return {
    id: row.id,
    contestPeriodId: row.contest_period_id,
    userId: row.user_id,
    primaryPhotoUrl: row.primary_photo_url,
    extraPhotoUrls: row.extra_photo_urls ?? [],
    status: row.status,
    entryTime: row.entry_time,
    rank: row.rank,
    fullName: profile?.fullName ?? null,
    username: profile?.username ?? null,
  };
}

export async function fetchNominations(contestPeriodId: number): Promise<Nomination[]> {
  const { data, error } = await supabase
    .from('nominations')
    .select(NOMINATION_COLUMNS)
    .eq('contest_period_id', contestPeriodId)
    .eq('status', 'active')
    .order('entry_time', { ascending: true });

  if (error) throw error;
  return Promise.all(((data ?? []) as RawNominationRow[]).map(toNomination));
}

export async function fetchMyNomination(
  contestPeriodId: number,
  userId: string
): Promise<Nomination | null> {
  const { data, error } = await supabase
    .from('nominations')
    .select(NOMINATION_COLUMNS)
    .eq('contest_period_id', contestPeriodId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return toNomination(data as RawNominationRow);
}

async function fetchNominationsByIds(ids: number[]): Promise<Nomination[]> {
  if (ids.length === 0) return [];

  const { data, error } = await supabase.from('nominations').select(NOMINATION_COLUMNS).in('id', ids);

  if (error) throw error;
  return Promise.all(((data ?? []) as RawNominationRow[]).map(toNomination));
}

export async function fetchNominationById(id: number): Promise<Nomination | null> {
  const results = await fetchNominationsByIds([id]);
  return results[0] ?? null;
}

export type ContestResultEntry = Nomination & { voteCount: number };

// get_contest_results only ever returns nomination_id/vote_count/rank - it
// never selects voter_id, so individual voter identity has no path out
// through this function regardless of who calls it. It also only returns
// rows once the contest is 'completed' (empty otherwise), so no tally is
// ever visible during active voting.
export async function fetchContestResults(contestPeriodId: number): Promise<ContestResultEntry[]> {
  const { data, error } = await supabase.rpc('get_contest_results', {
    p_contest_period_id: contestPeriodId,
  });

  if (error) throw error;

  const rows = (data ?? []) as { nomination_id: number; vote_count: number; rank: number | null }[];
  const nominations = await fetchNominationsByIds(rows.map((row) => row.nomination_id));
  const byId = new Map(nominations.map((nomination) => [nomination.id, nomination]));

  return rows
    .map((row) => {
      const nomination = byId.get(row.nomination_id);
      return nomination ? { ...nomination, voteCount: row.vote_count } : null;
    })
    .filter((entry): entry is ContestResultEntry => entry !== null);
}

async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
}

function extensionFromUri(uri: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(uri.split('?')[0]);
  return match ? match[1] : 'jpg';
}

export type SubmitNominationResult =
  | { kind: 'success'; nomination: Nomination }
  | { kind: 'ineligible'; message: string }
  | { kind: 'error'; message: string };

// Uploads happen BEFORE the DB insert here (unlike album.ts's insert-first
// pattern) because there's no per-user cap to enforce up front that would
// benefit from failing fast - the trigger-side eligibility checks (adult,
// gender match, contest still 'nominating') are cheap and the photos are
// needed either way, so a rejected insert simply leaves orphaned photos in
// the nominee's own storage folder rather than an orphaned DB row.
export async function submitNomination(input: {
  contestPeriodId: number;
  userId: string;
  primaryPhotoUri: string;
  extraPhotoUris: string[];
}): Promise<SubmitNominationResult> {
  const bucket = 'gym-face-nominations';
  const timestamp = Date.now();

  try {
    const primaryPath = `${input.userId}/nomination-${input.contestPeriodId}-${timestamp}-primary.${extensionFromUri(input.primaryPhotoUri)}`;
    const primaryBlob = await uriToBlob(input.primaryPhotoUri);
    const { error: primaryUploadError } = await supabase.storage
      .from(bucket)
      .upload(primaryPath, primaryBlob);
    if (primaryUploadError) throw primaryUploadError;
    const primaryPhotoUrl = supabase.storage.from(bucket).getPublicUrl(primaryPath).data.publicUrl;

    const extraPhotoUrls: string[] = [];
    for (let i = 0; i < input.extraPhotoUris.length; i += 1) {
      const uri = input.extraPhotoUris[i];
      const path = `${input.userId}/nomination-${input.contestPeriodId}-${timestamp}-extra-${i}.${extensionFromUri(uri)}`;
      const blob = await uriToBlob(uri);
      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, blob);
      if (uploadError) throw uploadError;
      extraPhotoUrls.push(supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl);
    }

    const { data, error } = await supabase
      .from('nominations')
      .insert({
        contest_period_id: input.contestPeriodId,
        user_id: input.userId,
        primary_photo_url: primaryPhotoUrl,
        extra_photo_urls: extraPhotoUrls,
        // Captured at the moment of submission - proof the consent text was
        // shown and accepted, per the explicit consent requirement.
        consent_accepted_at: new Date().toISOString(),
      })
      .select(NOMINATION_COLUMNS)
      .single();

    if (error) {
      // Default SQLSTATE for a plain RAISE EXCEPTION (trg_enforce_nomination_rules
      // has no custom code) is P0001 - same pattern as the other limit checks.
      if (error.code === 'P0001') {
        return { kind: 'ineligible', message: error.message };
      }
      return { kind: 'error', message: error.message };
    }

    return { kind: 'success', nomination: await toNomination(data as RawNominationRow) };
  } catch (err) {
    return {
      kind: 'error',
      message: err instanceof Error ? err.message : 'Failed to submit nomination.',
    };
  }
}

export async function withdrawNomination(
  nominationId: number
): Promise<{ kind: 'success' } | { kind: 'error'; message: string }> {
  const { error } = await supabase
    .from('nominations')
    .update({ status: 'withdrawn' })
    .eq('id', nominationId);

  if (error) return { kind: 'error', message: error.message };
  return { kind: 'success' };
}

export async function fetchMyVoteNomineeId(
  contestPeriodId: number,
  voterId: string
): Promise<number | null> {
  const { data, error } = await supabase
    .from('votes')
    .select('nominee_id')
    .eq('contest_period_id', contestPeriodId)
    .eq('voter_id', voterId)
    .maybeSingle();

  if (error) throw error;
  return data?.nominee_id ?? null;
}

export type CastVoteResult =
  | { kind: 'success' }
  | { kind: 'ineligible'; message: string }
  | { kind: 'error'; message: string };

export async function castVote(
  contestPeriodId: number,
  nomineeId: number,
  voterId: string
): Promise<CastVoteResult> {
  const { error } = await supabase
    .from('votes')
    .insert({ contest_period_id: contestPeriodId, nominee_id: nomineeId, voter_id: voterId });

  if (!error) return { kind: 'success' };
  if (error.code === '23505') {
    return { kind: 'ineligible', message: "You've already voted in this contest." };
  }
  if (error.code === 'P0001') {
    return { kind: 'ineligible', message: error.message };
  }
  return { kind: 'error', message: error.message };
}

// ============================================================
// Face of the City (bracket)
// ============================================================

// A gym's city bracket is found via its own primary location's city, same
// gym_locations -> localities -> cities chain used everywhere else in this
// feature. Returns the latest 'city' level contest for that city+gender, if
// any - used purely as a "see the City bracket" link from a gym's page.
export async function fetchCityContestIdForGym(
  gymId: number,
  gender: ContestGender
): Promise<number | null> {
  const { data: locationRow, error: locationError } = await supabase
    .from('gym_locations')
    .select('locality_id, localities(city_id)')
    .eq('gym_id', gymId)
    .eq('is_primary', true)
    .maybeSingle();

  if (locationError) throw locationError;
  // supabase-js can't infer to-one vs to-many embeds without generated
  // Database types (same caveat as gyms.ts's resolveLocationNames) - this is
  // actually a single related row, not an array.
  const cityId = (locationRow?.localities as unknown as { city_id: number } | null)?.city_id;
  if (!cityId) return null;

  const { data, error } = await supabase
    .from('contest_periods')
    .select('id')
    .eq('level', 'city')
    .eq('city_id', cityId)
    .eq('gender', gender)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

export async function fetchContestPeriod(contestPeriodId: number): Promise<ContestPeriod | null> {
  const { data, error } = await supabase
    .from('contest_periods')
    .select(CONTEST_COLUMNS)
    .eq('id', contestPeriodId)
    .maybeSingle();

  if (error) throw error;
  return data ? toContestPeriod(data as RawContestPeriodRow) : null;
}

type RawBracketRoundRow = {
  id: number;
  contest_period_id: number;
  round_number: number;
  voting_start: string;
  voting_end: string;
  status: 'pending' | 'voting' | 'completed';
};

export async function fetchBracketRounds(contestPeriodId: number): Promise<BracketRound[]> {
  const { data, error } = await supabase
    .from('bracket_rounds')
    .select('id, contest_period_id, round_number, voting_start, voting_end, status')
    .eq('contest_period_id', contestPeriodId)
    .order('round_number', { ascending: true });

  if (error) throw error;

  return ((data ?? []) as RawBracketRoundRow[]).map((row) => ({
    id: row.id,
    contestPeriodId: row.contest_period_id,
    roundNumber: row.round_number,
    votingStart: row.voting_start,
    votingEnd: row.voting_end,
    status: row.status,
  }));
}

type RawBracketMatchupRow = {
  id: number;
  round_id: number;
  nominee_a_id: number | null;
  nominee_b_id: number | null;
  winner_id: number | null;
  status: 'pending' | 'voting' | 'completed';
};

export async function fetchBracketMatchups(roundId: number): Promise<BracketMatchup[]> {
  const { data, error } = await supabase
    .from('bracket_matchups')
    .select('id, round_id, nominee_a_id, nominee_b_id, winner_id, status')
    .eq('round_id', roundId)
    .order('id', { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as RawBracketMatchupRow[];
  const nomineeIds = rows.flatMap((row) => [row.nominee_a_id, row.nominee_b_id]).filter(
    (id): id is number => id !== null
  );
  const nominations = await fetchNominationsByIds(nomineeIds);
  const byId = new Map(nominations.map((nomination) => [nomination.id, nomination]));

  return rows.map((row) => ({
    id: row.id,
    roundId: row.round_id,
    nomineeA: row.nominee_a_id !== null ? (byId.get(row.nominee_a_id) ?? null) : null,
    nomineeB: row.nominee_b_id !== null ? (byId.get(row.nominee_b_id) ?? null) : null,
    winnerId: row.winner_id,
    status: row.status,
  }));
}

// get_bracket_matchup_votes only returns rows once the matchup's ROUND has
// completed (see the migration) - empty while voting is still active, by
// design (the reveal rule: hidden mid-round, revealed once that round closes).
export async function fetchBracketMatchupVotes(
  matchupId: number
): Promise<{ nomineeId: number; voteCount: number }[]> {
  const { data, error } = await supabase.rpc('get_bracket_matchup_votes', {
    p_matchup_id: matchupId,
  });

  if (error) throw error;
  return ((data ?? []) as { nominee_id: number; vote_count: number }[]).map((row) => ({
    nomineeId: row.nominee_id,
    voteCount: row.vote_count,
  }));
}

export async function fetchMyBracketVote(
  matchupId: number,
  voterId: string
): Promise<number | null> {
  const { data, error } = await supabase
    .from('bracket_votes')
    .select('nominee_id')
    .eq('matchup_id', matchupId)
    .eq('voter_id', voterId)
    .maybeSingle();

  if (error) throw error;
  return data?.nominee_id ?? null;
}

export async function castBracketVote(
  matchupId: number,
  nomineeId: number,
  voterId: string
): Promise<CastVoteResult> {
  const { error } = await supabase
    .from('bracket_votes')
    .insert({ matchup_id: matchupId, nominee_id: nomineeId, voter_id: voterId });

  if (!error) return { kind: 'success' };
  if (error.code === '23505') {
    return { kind: 'ineligible', message: "You've already voted in this matchup." };
  }
  if (error.code === 'P0001') {
    return { kind: 'ineligible', message: error.message };
  }
  return { kind: 'error', message: error.message };
}
