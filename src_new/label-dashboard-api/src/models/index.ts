import { sequelize } from '../config/database';

// Import all models
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
import SongCollaborator from './SongCollaborator';
import SongAuthor from './SongAuthor';
import SongComposer from './SongComposer';
import Songwriter from './Songwriter';
import Fundraiser from './Fundraiser';
import Donation from './Donation';

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
Release.hasMany(Song, { foreignKey: 'release_id', as: 'songs' });

// ReleaseArtist relationships
ReleaseArtist.belongsTo(Artist, { foreignKey: 'artist_id', as: 'artist' });
ReleaseArtist.belongsTo(Release, { foreignKey: 'release_id', as: 'release' });

// Event relationships
Event.belongsTo(Brand, { foreignKey: 'brand_id', as: 'brand' });
Event.hasMany(Ticket, { foreignKey: 'event_id', as: 'tickets' });
Event.hasMany(EventReferrer, { foreignKey: 'event_id', as: 'referrers' });
Event.hasMany(TicketType, { foreignKey: 'event_id', as: 'ticketTypes' });

// EventReferrer relationships
EventReferrer.belongsTo(Event, { foreignKey: 'event_id', as: 'event' });
EventReferrer.hasMany(Ticket, { foreignKey: 'referrer_id', as: 'tickets' });

// Ticket relationships
Ticket.belongsTo(Event, { foreignKey: 'event_id', as: 'event' });
Ticket.belongsTo(EventReferrer, { foreignKey: 'referrer_id', as: 'referrer' });
Ticket.belongsTo(TicketType, { foreignKey: 'ticket_type_id', as: 'ticketType' });

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
Song.belongsTo(Release, { foreignKey: 'release_id', as: 'release' });
Song.hasMany(SongCollaborator, { foreignKey: 'song_id', as: 'collaborators' });
Song.hasMany(SongAuthor, { foreignKey: 'song_id', as: 'authors' });
Song.hasMany(SongComposer, { foreignKey: 'song_id', as: 'composers' });
Song.belongsToMany(Artist, {
  through: SongCollaborator,
  foreignKey: 'song_id',
  otherKey: 'artist_id',
  as: 'artistCollaborators'
});

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

// Export all models
export {
  sequelize,
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
  SongCollaborator,
  SongAuthor,
  SongComposer,
  Songwriter,
  Fundraiser,
  Donation,
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