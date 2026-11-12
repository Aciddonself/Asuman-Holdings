export const SITE = {
  name: 'Asuman Holdings',
  tagline: 'Your Dreamland Stream',
  phoneDisplay: '+256 760 790911',
  phoneTel: '+256760790911',
  whatsapp: '256760790911',
  country: 'Uganda',
  office: 'Kampala, Uganda',
  email: 'hello@asumanholdings.com',
};

export const waLink = (text) =>
  `https://wa.me/${SITE.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
