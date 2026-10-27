// The Balwyn example's own content, used to compare our layout against Tavor's example PDF.
import type { SummaryFields } from '../src/lib/types'

export const balwyn = (img: (name: string) => string): SummaryFields => ({
  address: '309 Whitehorse Road, Balwyn VIC 3103',
  date: '27 October 2026',
  heroImage: img('hero.jpg'),
  photo: img('interior.jpg'),
  description:
    'This shop-and-residence holding sits on a prominent spot in busy Whitehorse Road, on approx. 343 sqm* of Commercial 1 zoned land. At street level, the impressive 260 sqm* retail space has high ceilings, rear access, male and female amenities and plenty of storage. Upstairs is a spacious 130 sqm* home with its own entry from both front and rear.\n\nThe upstairs apartment has two main bedrooms with ensuites, a separate office/bedroom, an enclosed sunroom/study, a large laundry and a north-facing balcony. Car parking is on site, and the elevated courtyard has sweeping northerly views.',
  details: [
    { label: 'Property Type', value: 'Medical' },
    { label: 'Net Lettable Area', value: '482sqm' },
    { label: 'Frontage', value: '8.2m' },
    { label: 'Zoning', value: 'C1Z' },
    { label: 'Car Parking', value: '2 bays at rear' },
    { label: 'Public Transport', value: 'Train, Tram, Bus' },
  ],
  floorPlan: img('floorplan-1.jpg'),
  aerialImage: img('aerial.jpg'),
  demographics: [
    { label: 'Estimated Population (current)', value: '14,942' },
    { label: 'Projected Population', value: '16,502' },
    { label: 'Population Growth Rate', value: '0.93% p.a' },
    { label: 'Median Age', value: '43' },
    { label: 'Worker Professions', value: 'White-collar (57%)' },
    { label: 'Employment', value: '95% employed' },
    { label: 'Retail Spending Per Capital', value: '$16,400 p.a' },
  ],
  developments: [
    { name: 'White & Weston', address: '259 Whitehorse Road, Balwyn', type: 'Apartment Building', description: 'Luxury apartment development comprising 45 residences delivered in collaboration with Coles - will have a ground floor Coles supermarket', image: img('dev-1.jpg') },
    { name: 'Project name 2', address: '00, 00000 street, Suburb, 3000', type: 'Development type', description: 'Opti none pla disimusa corepro que sitas del iducius, il incte ne dolupid ut eum everchi liquunt adiaece pernati. Cat pa coremAtate la eost occuptatem qui blat. Harchilibus. Elibus aut ut andam is doluptatur.', image: img('dev-2.jpg') },
    { name: 'Project name 3', address: '00, 00000 street, Suburb, 3000', type: 'Development type', description: 'Opti none pla disimusa corepro que sitas del iducius, il incte ne dolupid ut eum everchi liquunt adiaece pernati. Cat pa coremAtate la eost occuptatem qui blat. Harchilibus. Elibus aut ut andam is doluptatur.', image: img('dev-3.jpg') },
    { name: 'Project name 4', address: '00, 00000 street, Suburb, 3000', type: 'Development type', description: 'Opti none pla disimusa corepro que sitas del iducius, il incte ne dolupid ut eum everchi liquunt adiaece pernati. Cat pa coremAtate la eost occuptatem qui blat. Harchilibus. Elibus aut ut andam is doluptatur.', image: img('dev-4.jpg') },
  ],
  qrImage: '/brand/qr.png',
  disclaimer: 'This summary is strictly confidential, provided by Tavor for discussion purposes only; it does not constitute an offer or binding commitment and must not be disclosed to any third party without Tavor’s written consent.',
})
