export type GymStatus = 'draft' | 'active' | 'suspended' | 'closed';
export type GymVerificationStatus = 'unclaimed' | 'claimed' | 'verified';

export type Gym = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  status: GymStatus;
  verification_status: GymVerificationStatus;
  location: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  category: string | null;
  latitude: number | null;
  longitude: number | null;
};

// Relative to the gym's own city (see the gym_price_tiers view, driven by
// the LOWEST monthly_equivalent across a gym's pricing plans) - null when
// the gym has no plan set, or no resolvable city to rank it within, rather
// than being forced into a bucket.
export type GymPriceTier = 'budget' | 'mid' | 'premium';

export type GymWithDiscoverData = Gym & {
  rating: number | null;
  reviewCount: number;
  photoUrl: string | null;
  memberCount: number | null;
  distanceKm: number | null;
  priceTier: GymPriceTier | null;
};

export type GymPlanType = 'monthly' | 'quarterly' | 'half_yearly' | 'annual';

export type GymPricingPlan = {
  id: number;
  gymId: number;
  planType: GymPlanType;
  price: number;
  monthlyEquivalent: number;
};

export type LocationOption = {
  id: number;
  name: string;
};

export type OnboardingAdminStatus = 'pending_review' | 'verified' | 'rejected';

export type OnboardingRequest = {
  id: number;
  gym_id: number;
  submitted_by: string;
  admin_status: OnboardingAdminStatus;
  admin_notes: string | null;
  created_at: string;
  gym: {
    id: number;
    name: string;
  };
};

export type OnboardingDocumentType =
  | 'business_registration'
  | 'id_proof'
  | 'lease_agreement'
  | 'other';

export type GymDetail = Gym & {
  locationId: number | null;
  photoUrl: string | null;
  avgRating: number | null;
  reviewCount: number;
};

export type BusyHour = {
  hour: number;
  count: number;
};

export type CheckInSummary = {
  streakDays: number;
  totalDaysLogged: number;
};

export type MyGym = {
  gymId: number;
  gymName: string;
};

export type CheckInHistoryEntry = {
  id: number;
  gymId: number;
  gymName: string;
  checkedInAt: string;
};

export type DayNote = {
  id: number;
  gymId: number;
  noteDate: string; // 'YYYY-MM-DD'
  noteText: string;
};

export type TeamMember = {
  id: number;
  userId: string;
  role: string;
  displayName: string;
  avatarUrl: string | null;
  // Drives whether a trainer row links to the full trainer profile or falls
  // back to the plain public profile (e.g. a trainer added before profiles
  // existed).
  hasTrainerProfile: boolean;
};

export type TrainerProfile = {
  userId: string;
  bio: string | null;
  specialties: string[];
  yearsExperience: number | null;
  photoPath: string | null;
  photoUrl: string | null;
};

export type TrainerCertification = {
  id: number;
  title: string;
  issuingBody: string;
  // Path in the private trainer-certificates bucket - never a URL. Viewing
  // goes through short-lived signed URLs (see fetchCertificatePhotoUrls).
  photoPath: string | null;
};

export type TrainerAffiliation = {
  gymId: number;
  gymName: string;
  city: string | null;
};

// One of the caller's own NON-active gym_staff rows - a request that's still
// pending or was declined, or a stint that ended. There are no push
// notifications, so this is how someone finds out (on their own profile, next
// time they look) that they were removed, or confirms that they left.
export type MyGymHistoryItem = {
  id: number;
  gymId: number;
  gymName: string;
  role: string;
  status: 'pending' | 'rejected' | 'removed' | 'suspended';
  // For 'removed': true = they left on their own, false = an owner/admin removed them.
  leftByChoice: boolean;
  // When it was decided / ended; null for a request still pending.
  at: string | null;
};

export type StaffRequest = {
  requestId: number;
  requesterId: string;
  requestedRole: string;
  requestedAt: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  trainerBio: string | null;
  specialties: string[];
  yearsExperience: number | null;
  certificationCount: number;
};

export type GymReview = {
  id: number;
  userId: string;
  rating: number;
  title: string | null;
  reviewText: string | null;
  isVerifiedVisit: boolean;
  createdAt: string;
  reviewerName: string;
};

// Self-identified, never inferred or defaulted - required only to be
// nominated for the future "Face of the Gym/City" feature, not for any
// existing functionality.
export type Gender = 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';

export type Profile = {
  id: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  city: string | null;
  phoneNumber: string | null;
  gender: Gender | null;
  // ISO date string ('YYYY-MM-DD'), self-reported, never inferred/defaulted.
  dateOfBirth: string | null;
  // Capped at 2 by the trg_enforce_dob_edit_limit DB trigger; the initial
  // null -> value entry doesn't count, only later changes do.
  dobEditCount: number;
};

export type FollowedGym = {
  gymId: number;
  gymName: string;
};

// ---- Membership terms (private: only the member themself and that gym's
// owners/admins ever receive these; all dates are IST calendar dates as
// 'YYYY-MM-DD' strings, computed by the server). ----

// pending/rejected/removed are the raw gym_members statuses; the rest apply to
// an 'active' member: no_plan = legacy member with no term yet (treated as
// active), expiring_soon = inside the plan's reminder window, expired = the
// current term's last day has passed.
export type MembershipState =
  | 'pending'
  | 'rejected'
  | 'removed'
  | 'active'
  | 'expiring_soon'
  | 'expired'
  | 'no_plan';

// The caller's OWN membership at a gym (get_my_memberships).
export type MyMembership = {
  gymId: number;
  gymName: string;
  memberId: number;
  memberStatus: string;
  state: MembershipState;
  planType: GymPlanType | null;
  startDate: string | null;
  endDate: string | null;
  daysLeft: number | null;
  reminderWindowDays: number | null;
};

export type OwnerMemberState = 'active' | 'expiring_soon' | 'expired' | 'no_plan';

export type OwnerMember = {
  memberId: number;
  userId: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  planType: GymPlanType | null;
  startDate: string | null;
  endDate: string | null;
  daysLeft: number | null;
  state: OwnerMemberState;
};

export type MemberRequest = {
  memberId: number;
  userId: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  requestedAt: string;
};

export type OwnerMembersSummary = {
  // Currently-active members: includes expiring soon and no-plan, excludes expired.
  active: number;
  expiringSoon: number;
  expiringWithin7Days: number;
  expired: number;
  noPlan: number;
  byPlan: Record<GymPlanType, number>;
};

export type OwnerMembersData = {
  today: string;
  summary: OwnerMembersSummary;
  members: OwnerMember[];
  requests: MemberRequest[];
};

// What a renewal / approval WOULD record - computed by the server so the app
// does no date arithmetic of its own.
export type TermPreview = {
  startDate: string;
  endDate: string;
  today: string;
};

export type MyGymRelationship = {
  gymId: number;
  gymName: string;
  label: string;
  // Shown under the gym name while a membership is inside its reminder window,
  // e.g. "Ends 24 Oct · 12 days left".
  note?: string;
};

// In-app notification (no push - rows are created by the daily membership
// reminder job and read here).
export type NotificationKind =
  | 'membership_expiring'
  | 'membership_expiring_final'
  | 'membership_expired';

export type AppNotification = {
  id: number;
  gymId: number;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

export type PublicProfile = {
  id: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
};

export type FollowedUser = {
  userId: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
};

export type MessageThreadStatus = 'pending' | 'accepted';

export type MessageThread = {
  id: number;
  otherUserId: string;
  otherUserFullName: string | null;
  otherUserUsername: string | null;
  otherUserAvatarUrl: string | null;
  status: MessageThreadStatus;
  // Whether the CURRENT viewer initiated this thread - the recipient is
  // whoever didn't. Only the recipient can accept/report/delete.
  initiatedByMe: boolean;
  createdAt: string;
  reportedAt: string | null;
};

export type Message = {
  id: number;
  threadId: number;
  senderId: string;
  body: string;
  createdAt: string;
};

export type AlbumMediaType = 'photo' | 'video';

// 'private' means uploader + mutual followers only, enforced by storage RLS
// on the profile-media-private bucket - see is_mutual_follow().
export type AlbumVisibility = 'public' | 'private';

export type AlbumItem = {
  id: number;
  mediaType: AlbumMediaType;
  filePath: string;
  url: string;
  durationSeconds: number | null;
  thumbnailPath: string | null;
  thumbnailUrl: string | null;
  visibility: AlbumVisibility;
};

export type ContestGender = 'male' | 'female';
export type ContestStatus = 'nominating' | 'voting' | 'runoff' | 'completed';
export type ContestLevel = 'gym' | 'city';

export type ContestPeriod = {
  id: number;
  level: ContestLevel;
  // Exactly one of these is set, matching level ('gym' -> gymId, 'city' -> cityId).
  gymId: number | null;
  cityId: number | null;
  gender: ContestGender;
  nominationStart: string;
  nominationEnd: string;
  votingStart: string;
  votingEnd: string;
  status: ContestStatus;
  winnerId: number | null;
  parentContestPeriodId: number | null;
};

export type BracketRoundStatus = 'pending' | 'voting' | 'completed';

export type BracketRound = {
  id: number;
  contestPeriodId: number;
  roundNumber: number;
  votingStart: string;
  votingEnd: string;
  status: BracketRoundStatus;
};

export type BracketMatchupStatus = 'pending' | 'voting' | 'completed';

export type BracketMatchup = {
  id: number;
  roundId: number;
  nomineeA: Nomination | null;
  nomineeB: Nomination | null;
  winnerId: number | null;
  status: BracketMatchupStatus;
};

export type NominationStatus = 'active' | 'withdrawn';

export type Nomination = {
  id: number;
  contestPeriodId: number;
  userId: string;
  primaryPhotoUrl: string;
  extraPhotoUrls: string[];
  status: NominationStatus;
  entryTime: string;
  rank: number | null;
  fullName: string | null;
  username: string | null;
};
