import { sequelize } from '../config/database';

// Import all models
import AudienceUser from './AudienceUser';
import User from './User';
import Brand from './Brand';
import Artist from './Artist';
import Release from './Release';
import ReleaseArtist from './ReleaseArtist';
import Event from './Event';
import EventReferrer from './EventReferrer';
import Ticket from './Ticket';
import TicketType from './TicketType';
import Payment from './Payment';
import PaymentMethod from './PaymentMethod';
import Earning from './Earning';
import Royalty from './Royalty';
import RecuperableExpense from './RecuperableExpense';
import ArtistImage from './ArtistImage';
import ArtistDocument from './ArtistDocument';
import ArtistAccess from './ArtistAccess';
import Domain from './Domain';
import LoginAttempt from './LoginAttempt';
import EmailAttempt from './EmailAttempt';
import LabelPaymentMethod from './LabelPaymentMethod';
import LabelPayment from './LabelPayment';
import Song from './Song';
import ReleaseSong from './ReleaseSong';
import SongCollaborator from './SongCollaborator';
import SongAuthor from './SongAuthor';
import SongComposer from './SongComposer';
import Songwriter from './Songwriter';
import Fundraiser from './Fundraiser';
import Donation from './Donation';
import SyncLicensingPitch from './SyncLicensingPitch';
import SyncLicensingPitchSong from './SyncLicensingPitchSong';
import PressCampaign from './PressCampaign';
import PressCampaignArtistPhoto from './PressCampaignArtistPhoto';
import PressCampaignLink from './PressCampaignLink';
import WalkInType from './WalkInType';
import WalkInTransaction from './WalkInTransaction';
import WalkInTransactionItem from './WalkInTransactionItem';
import Notification from './Notification';
import EventTag from './EventTag';
import EventTagMapping from './EventTagMapping';
import WristbandColor from './WristbandColor';
import WristbandOrder from './WristbandOrder';
import WristbandOrderItem from './WristbandOrderItem';
import EventWristbandSettings from './EventWristbandSettings';
import SavedDeliveryAddress from './SavedDeliveryAddress';
import EventAddOnPayment from './EventAddOnPayment';
import EventLike from './EventLike';
import AudienceFollow from './AudienceFollow';

// Define relationships
// Brand relationships
Brand.hasMany(User, { foreignKey: 'brand_id', as: 'users' });
Brand.hasMany(Artist, { foreignKey: 'brand_id', as: 'artists' });
Brand.hasMany(Event, { foreignKey: 'brand_id', as: 'events' });
Brand.hasMany(Release, { foreignKey: 'brand_id', as: 'releases' });
Brand.hasMany(RecuperableExpense, { foreignKey: 'brand_id', as: 'expenses' });
Brand.hasMany(LoginAttempt, { foreignKey: 'brand_id', as: 'loginAttempts' });
Brand.hasMany(EmailAttempt, { foreignKey: 'brand_id', as: 'emailAttempts' });
Brand.hasMany(Domain, { foreignKey: 'brand_id', as: 'domains' });
Brand.hasMany(LabelPaymentMethod, { foreignKey: 'brand_id', as: 'labelPaymentMethods' });
Brand.hasMany(LabelPayment, { foreignKey: 'brand_id', as: 'labelPayments' });
Brand.hasMany(Fundraiser, { foreignKey: 'brand_id', as: 'fundraisers' });

// Brand self-referencing relationships for parent-child hierarchy
Brand.hasMany(Brand, { foreignKey: 'parent_brand', as: 'childBrands' });
Brand.belongsTo(Brand, { foreignKey: 'parent_brand', as: 'parentBrand' });

// User relationships
User.belongsTo(Brand, { foreignKey: 'brand_id', as: 'brand' });
User.hasMany(LoginAttempt, { foreignKey: 'user_id', as: 'loginAttempts' });
User.belongsToMany(Artist, { 
  through: ArtistAccess, 
  foreignKey: 'user_id', 
  otherKey: 'artist_id',
  as: 'artistAccess' 
});

// Artist relationships
Artist.belongsTo(Brand, { foreignKey: 'brand_id', as: 'brand' });
Artist.hasMany(Payment, { foreignKey: 'artist_id', as: 'payments' });
Artist.hasMany(PaymentMethod, { foreignKey: 'artist_id', as: 'paymentMethods' });
Artist.hasMany(Royalty, { foreignKey: 'artist_id', as: 'royalties' });
Artist.hasMany(ArtistImage, { foreignKey: 'artist_id', as: 'images' });
Artist.hasMany(ArtistDocument, { foreignKey: 'artist_id', as: 'documents' });
Artist.belongsToMany(User, { 
  through: ArtistAccess, 
  foreignKey: 'artist_id', 
  otherKey: 'user_id',
  as: 'userAccess' 
});
Artist.hasMany(ReleaseArtist, { foreignKey: 'artist_id', as: 'releaseArtists' });
Artist.belongsToMany(Release, { 
  through: ReleaseArtist, 
  foreignKey: 'artist_id', 
  otherKey: 'release_id',
  as: 'releases' 
});
Artist.belongsTo(ArtistImage, { foreignKey: 'profile_photo_id', as: 'profilePhotoImage' });

// Release relationships
Release.belongsTo(Brand, { foreignKey: 'brand_id', as: 'brand' });
Release.hasMany(Earning, { foreignKey: 'release_id', as: 'earnings' });
Release.hasMany(Royalty, { foreignKey: 'release_id', as: 'royalties' });
Release.hasMany(RecuperableExpense, { foreignKey: 'release_id', as: 'expenses' });
Release.hasMany(ReleaseArtist, { foreignKey: 'release_id', as: 'releaseArtists' });
Release.belongsToMany(Artist, {
  through: ReleaseArtist,
  foreignKey: 'release_id',
  otherKey: 'artist_id',
  as: 'artists'
});
Release.belongsToMany(Song, {
  through: ReleaseSong,
  foreignKey: 'release_id',
  otherKey: 'song_id',
  as: 'songs'
});
Release.hasMany(ReleaseSong, { foreignKey: 'release_id', as: 'releaseSongs' });

// ReleaseArtist relationships
ReleaseArtist.belongsTo(Artist, { foreignKey: 'artist_id', as: 'artist' });
ReleaseArtist.belongsTo(Release, { foreignKey: 'release_id', as: 'release' });

// EventTag / EventTagMapping relationships
Event.belongsToMany(EventTag, { through: EventTagMapping, foreignKey: 'event_id', otherKey: 'tag_id', as: 'tags' });
EventTag.belongsToMany(Event, { through: EventTagMapping, foreignKey: 'tag_id', otherKey: 'event_id', as: 'events' });
EventTag.belongsTo(Brand, { foreignKey: 'brand_id', as: 'brand' });
Brand.hasMany(EventTag, { foreignKey: 'brand_id', as: 'eventTags' });

// Event relationships
Event.belongsTo(Brand, { foreignKey: 'brand_id', as: 'brand' });
Event.hasMany(Ticket, { foreignKey: 'event_id', as: 'tickets' });
Event.hasMany(EventReferrer, { foreignKey: 'event_id', as: 'referrers' });
Event.hasMany(TicketType, { foreignKey: 'event_id', as: 'ticketTypes' });
Event.hasMany(WalkInType, { foreignKey: 'event_id', as: 'walkInTypes' });
Event.hasMany(WalkInTransaction, { foreignKey: 'event_id', as: 'walkInTransactions' });
Event.hasMany(WristbandOrder, { foreignKey: 'event_id', as: 'wristbandOrders' });
Event.hasOne(EventWristbandSettings, { foreignKey: 'event_id', as: 'wristbandSettings' });

// WristbandOrder relationships
WristbandOrder.belongsTo(Event, { foreignKey: 'event_id', as: 'event' });
WristbandOrder.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
WristbandOrder.hasMany(WristbandOrderItem, { foreignKey: 'order_id', as: 'items' });

// WristbandOrderItem relationships
WristbandOrderItem.belongsTo(WristbandOrder, { foreignKey: 'order_id', as: 'order' });
WristbandOrderItem.belongsTo(WristbandColor, { foreignKey: 'wristband_color_id', as: 'color' });

// EventWristbandSettings relationships
EventWristbandSettings.belongsTo(Event, { foreignKey: 'event_id', as: 'event' });

// SavedDeliveryAddress relationships
SavedDeliveryAddress.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(SavedDeliveryAddress, { foreignKey: 'user_id', as: 'savedDeliveryAddresses' });

// EventAddOnPayment relationships
EventAddOnPayment.belongsTo(Event, { foreignKey: 'event_id', as: 'event' });
EventAddOnPayment.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Event.hasMany(EventAddOnPayment, { foreignKey: 'event_id', as: 'addOnPayments' });

// EventReferrer relationships
EventReferrer.belongsTo(Event, { foreignKey: 'event_id', as: 'event' });
EventReferrer.hasMany(Ticket, { foreignKey: 'referrer_id', as: 'tickets' });

// Ticket relationships
Ticket.belongsTo(Event, { foreignKey: 'event_id', as: 'event' });
Ticket.belongsTo(EventReferrer, { foreignKey: 'referrer_id', as: 'referrer' });
Ticket.belongsTo(TicketType, { foreignKey: 'ticket_type_id', as: 'ticketType' });
Ticket.belongsTo(AudienceUser, { foreignKey: 'audience_user_id', as: 'audienceUser' });

// AudienceUser relationships
AudienceUser.hasMany(Ticket, { foreignKey: 'audience_user_id', as: 'tickets' });
AudienceUser.hasMany(EventLike, { foreignKey: 'audience_user_id', as: 'eventLikes' });
AudienceUser.hasMany(AudienceFollow, { foreignKey: 'audience_user_id', as: 'follows' });

// AudienceFollow relationships
AudienceFollow.belongsTo(AudienceUser, { foreignKey: 'audience_user_id', as: 'audienceUser' });
AudienceFollow.belongsTo(Brand, { foreignKey: 'brand_id', as: 'brand' });
Brand.hasMany(AudienceFollow, { foreignKey: 'brand_id', as: 'audienceFollows' });

// EventLike relationships
EventLike.belongsTo(AudienceUser, { foreignKey: 'audience_user_id', as: 'audienceUser' });
EventLike.belongsTo(Event, { foreignKey: 'event_id', as: 'event' });
Event.hasMany(EventLike, { foreignKey: 'event_id', as: 'likes' });

// TicketType relationships
TicketType.belongsTo(Event, { foreignKey: 'event_id', as: 'event' });
TicketType.hasMany(Ticket, { foreignKey: 'ticket_type_id', as: 'tickets' });

// Payment relationships
Payment.belongsTo(Artist, { foreignKey: 'artist_id', as: 'artist' });
Payment.belongsTo(PaymentMethod, { foreignKey: 'payment_method_id', as: 'paymentMethod' });

// PaymentMethod relationships
PaymentMethod.belongsTo(Artist, { foreignKey: 'artist_id', as: 'artist' });
PaymentMethod.hasMany(Payment, { foreignKey: 'payment_method_id', as: 'payments' });

// Earning relationships
Earning.belongsTo(Release, { foreignKey: 'release_id', as: 'release' });
Earning.hasMany(Royalty, { foreignKey: 'earning_id', as: 'royalties' });

// Royalty relationships
Royalty.belongsTo(Artist, { foreignKey: 'artist_id', as: 'artist' });
Royalty.belongsTo(Earning, { foreignKey: 'earning_id', as: 'earning' });
Royalty.belongsTo(Release, { foreignKey: 'release_id', as: 'release' });

// RecuperableExpense relationships
RecuperableExpense.belongsTo(Release, { foreignKey: 'release_id', as: 'release' });
RecuperableExpense.belongsTo(Brand, { foreignKey: 'brand_id', as: 'brand' });

// ArtistImage relationships
ArtistImage.belongsTo(Artist, { foreignKey: 'artist_id', as: 'artist' });

// ArtistDocument relationships
ArtistDocument.belongsTo(Artist, { foreignKey: 'artist_id', as: 'artist' });

// ArtistAccess relationships
ArtistAccess.belongsTo(Artist, { foreignKey: 'artist_id', as: 'artist' });
ArtistAccess.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Domain relationships
Domain.belongsTo(Brand, { foreignKey: 'brand_id', as: 'brand' });

// LoginAttempt relationships
LoginAttempt.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
LoginAttempt.belongsTo(Brand, { foreignKey: 'brand_id', as: 'brand' });

// EmailAttempt relationships
EmailAttempt.belongsTo(Brand, { foreignKey: 'brand_id', as: 'brand' });

// LabelPaymentMethod relationships
LabelPaymentMethod.belongsTo(Brand, { foreignKey: 'brand_id', as: 'brand' });
LabelPaymentMethod.hasMany(LabelPayment, { foreignKey: 'payment_method_id', as: 'labelPayments' });

// LabelPayment relationships
LabelPayment.belongsTo(Brand, { foreignKey: 'brand_id', as: 'brand' });
LabelPayment.belongsTo(LabelPaymentMethod, { foreignKey: 'payment_method_id', as: 'paymentMethod' });

// Song relationships
Song.belongsToMany(Release, {
  through: ReleaseSong,
  foreignKey: 'song_id',
  otherKey: 'release_id',
  as: 'releases'
});
Song.hasMany(ReleaseSong, { foreignKey: 'song_id', as: 'releaseSongs' });
Song.hasMany(SongCollaborator, { foreignKey: 'song_id', as: 'collaborators' });
Song.hasMany(SongAuthor, { foreignKey: 'song_id', as: 'authors' });
Song.hasMany(SongComposer, { foreignKey: 'song_id', as: 'composers' });
Song.belongsToMany(Artist, {
  through: SongCollaborator,
  foreignKey: 'song_id',
  otherKey: 'artist_id',
  as: 'artistCollaborators'
});

// ReleaseSong relationships
ReleaseSong.belongsTo(Song, { foreignKey: 'song_id', as: 'song' });
ReleaseSong.belongsTo(Release, { foreignKey: 'release_id', as: 'release' });

// SongCollaborator relationships
SongCollaborator.belongsTo(Song, { foreignKey: 'song_id', as: 'song' });
SongCollaborator.belongsTo(Artist, { foreignKey: 'artist_id', as: 'artist' });

// SongAuthor relationships
SongAuthor.belongsTo(Song, { foreignKey: 'song_id', as: 'song' });
SongAuthor.belongsTo(Songwriter, { foreignKey: 'songwriter_id', as: 'songwriter' });

// SongComposer relationships
SongComposer.belongsTo(Song, { foreignKey: 'song_id', as: 'song' });
SongComposer.belongsTo(Songwriter, { foreignKey: 'songwriter_id', as: 'songwriter' });

// Songwriter relationships
Songwriter.hasMany(SongAuthor, { foreignKey: 'songwriter_id', as: 'songAuthors' });
Songwriter.hasMany(SongComposer, { foreignKey: 'songwriter_id', as: 'songComposers' });

// Fundraiser relationships
Fundraiser.belongsTo(Brand, { foreignKey: 'brand_id', as: 'brand' });
Fundraiser.hasMany(Donation, { foreignKey: 'fundraiser_id', as: 'donations' });

// Donation relationships
Donation.belongsTo(Fundraiser, { foreignKey: 'fundraiser_id', as: 'fundraiser' });

// SyncLicensingPitch relationships
SyncLicensingPitch.belongsTo(Brand, { foreignKey: 'brand_id', as: 'brand' });
SyncLicensingPitch.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
SyncLicensingPitch.hasMany(SyncLicensingPitchSong, { foreignKey: 'pitch_id', as: 'pitchSongs' });
SyncLicensingPitch.belongsToMany(Song, {
  through: SyncLicensingPitchSong,
  foreignKey: 'pitch_id',
  otherKey: 'song_id',
  as: 'songs'
});

// SyncLicensingPitchSong relationships
SyncLicensingPitchSong.belongsTo(SyncLicensingPitch, { foreignKey: 'pitch_id', as: 'pitch' });
SyncLicensingPitchSong.belongsTo(Song, { foreignKey: 'song_id', as: 'song' });

// Song relationships to SyncLicensingPitch (reverse)
Song.belongsToMany(SyncLicensingPitch, {
  through: SyncLicensingPitchSong,
  foreignKey: 'song_id',
  otherKey: 'pitch_id',
  as: 'pitches'
});

// Brand relationships to SyncLicensingPitch
Brand.hasMany(SyncLicensingPitch, { foreignKey: 'brand_id', as: 'syncLicensingPitches' });

// PressCampaign relationships
PressCampaign.belongsTo(Brand, { foreignKey: 'brand_id', as: 'brand' });
PressCampaign.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
PressCampaign.belongsTo(Artist, { foreignKey: 'artist_id', as: 'artist' });
PressCampaign.belongsTo(Release, { foreignKey: 'release_id', as: 'release' });
PressCampaign.belongsTo(Event, { foreignKey: 'event_id', as: 'event' });
PressCampaign.hasMany(PressCampaignArtistPhoto, { foreignKey: 'campaign_id', as: 'artistPhotos' });
PressCampaign.hasMany(PressCampaignLink, { foreignKey: 'campaign_id', as: 'links' });
Brand.hasMany(PressCampaign, { foreignKey: 'brand_id', as: 'pressCampaigns' });

// PressCampaignArtistPhoto relationships
PressCampaignArtistPhoto.belongsTo(PressCampaign, { foreignKey: 'campaign_id', as: 'campaign' });

// PressCampaignLink relationships
PressCampaignLink.belongsTo(PressCampaign, { foreignKey: 'campaign_id', as: 'campaign' });

// Notification relationships
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Notification.belongsTo(Brand, { foreignKey: 'brand_id', as: 'brand' });
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });

// WalkInType relationships
WalkInType.belongsTo(Event, { foreignKey: 'event_id', as: 'event' });
WalkInType.hasMany(WalkInTransactionItem, { foreignKey: 'walk_in_type_id', as: 'transactionItems' });

// WalkInTransaction relationships
WalkInTransaction.belongsTo(Event, { foreignKey: 'event_id', as: 'event' });
WalkInTransaction.belongsTo(User, { foreignKey: 'registered_by', as: 'registeredByUser' });
WalkInTransaction.hasMany(WalkInTransactionItem, { foreignKey: 'walk_in_transaction_id', as: 'items' });

// WalkInTransactionItem relationships
WalkInTransactionItem.belongsTo(WalkInTransaction, { foreignKey: 'walk_in_transaction_id', as: 'transaction' });
WalkInTransactionItem.belongsTo(WalkInType, { foreignKey: 'walk_in_type_id', as: 'walkInType' });

// Export all models
export {
  sequelize,
  AudienceUser,
  User,
  Brand,
  Artist,
  Release,
  ReleaseArtist,
  Event,
  EventReferrer,
  Ticket,
  TicketType,
  Payment,
  PaymentMethod,
  Earning,
  Royalty,
  RecuperableExpense,
  ArtistImage,
  ArtistDocument,
  ArtistAccess,
  Domain,
  LoginAttempt,
  EmailAttempt,
  LabelPaymentMethod,
  LabelPayment,
  Song,
  ReleaseSong,
  SongCollaborator,
  SongAuthor,
  SongComposer,
  Songwriter,
  Fundraiser,
  Donation,
  SyncLicensingPitch,
  SyncLicensingPitchSong,
  PressCampaign,
  PressCampaignArtistPhoto,
  PressCampaignLink,
  WalkInType,
  WalkInTransaction,
  WalkInTransactionItem,
  Notification,
  EventTag,
  EventTagMapping,
  WristbandColor,
  WristbandOrder,
  WristbandOrderItem,
  EventWristbandSettings,
  SavedDeliveryAddress,
  EventAddOnPayment,
  EventLike,
  AudienceFollow,
};

// Initialize database connection
export const initializeDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    
    // Skip auto-sync in production and development - use migrations instead
    if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'development') {
      await sequelize.sync({ force: false });
      console.log('✅ Database models synchronized.');
    } else {
      console.log('✅ Auto-sync disabled: Using migrations instead.');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    return false;
  }
};