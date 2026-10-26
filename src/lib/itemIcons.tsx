import {
  Tv, Music, Headphones, Smartphone, Wifi, Dumbbell, Trees, Castle, Newspaper, Gamepad2, Cloud, Sparkles,
  Utensils, TrainFront, Car, House, Zap, Shield, Heart, Baby, GraduationCap, ShoppingCart, Coffee, Plane,
  PawPrint, Gift, Scissors, Shirt, Package, PiggyBank, CreditCard, ReceiptPoundSterling as Receipt, Repeat, FileText, Film, BookOpen,
  Bike, Fuel, Droplets, Stethoscope, Laptop, Ticket, Palette, Bus, type LucideIcon,
} from 'lucide-react'

/** Icons a bill can wear, in the order the picker shows them. */
export const ITEM_ICONS: Record<string, { Icon: LucideIcon; label: string }> = {
  tv: { Icon: Tv, label: 'TV' }, film: { Icon: Film, label: 'Film' }, music: { Icon: Music, label: 'Music' },
  headphones: { Icon: Headphones, label: 'Audio' }, phone: { Icon: Smartphone, label: 'Phone' }, wifi: { Icon: Wifi, label: 'Broadband' },
  cloud: { Icon: Cloud, label: 'Cloud storage' }, laptop: { Icon: Laptop, label: 'Software' }, sparkles: { Icon: Sparkles, label: 'AI' },
  games: { Icon: Gamepad2, label: 'Games' }, news: { Icon: Newspaper, label: 'News' }, book: { Icon: BookOpen, label: 'Books' },
  gym: { Icon: Dumbbell, label: 'Fitness' }, trees: { Icon: Trees, label: 'Outdoors' }, castle: { Icon: Castle, label: 'Heritage' },
  ticket: { Icon: Ticket, label: 'Days out' }, food: { Icon: Utensils, label: 'Food' }, coffee: { Icon: Coffee, label: 'Coffee' },
  shopping: { Icon: ShoppingCart, label: 'Shopping' }, train: { Icon: TrainFront, label: 'Train' }, bus: { Icon: Bus, label: 'Bus' },
  car: { Icon: Car, label: 'Car' }, fuel: { Icon: Fuel, label: 'Fuel' }, bike: { Icon: Bike, label: 'Bike' }, plane: { Icon: Plane, label: 'Travel' },
  home: { Icon: House, label: 'Home' }, energy: { Icon: Zap, label: 'Energy' }, water: { Icon: Droplets, label: 'Water' },
  shield: { Icon: Shield, label: 'Insurance' }, health: { Icon: Stethoscope, label: 'Health' }, heart: { Icon: Heart, label: 'Charity' },
  baby: { Icon: Baby, label: 'Children' }, school: { Icon: GraduationCap, label: 'Education' }, pet: { Icon: PawPrint, label: 'Pets' },
  gift: { Icon: Gift, label: 'Gifts' }, hair: { Icon: Scissors, label: 'Haircut' }, clothes: { Icon: Shirt, label: 'Clothes' },
  box: { Icon: Package, label: 'Deliveries' }, art: { Icon: Palette, label: 'Hobbies' }, savings: { Icon: PiggyBank, label: 'Savings' },
  card: { Icon: CreditCard, label: 'Card' }, bill: { Icon: Receipt, label: 'Bill' }, repeat: { Icon: Repeat, label: 'Subscription' },
  contract: { Icon: FileText, label: 'Contract' },
}

/** First match wins, so the more specific names come first. */
const GUESSES: [RegExp, string][] = [
  [/tv licen[cs]e/i, 'tv'],
  [/insur|assurance|life cover/i, 'shield'],
  [/phone|mobile|\bsim\b|voxi|giffgaff|smarty|lebara|\bee\b|vodafone|\bo2\b|\bthree\b/i, 'phone'],
  [/broadband|wi-?fi|fibre|internet|\bbt\b|virgin|plusnet|talktalk|hyperoptic/i, 'wifi'],
  [/netflix|disney|prime video|now tv|\bsky\b|britbox|paramount|apple tv|youtube|\bitv\b/i, 'tv'],
  [/spotify|apple music|tidal|deezer|music/i, 'music'],
  [/audible|podcast/i, 'headphones'],
  [/kindle|book/i, 'book'],
  [/national trust|woodland|rspb|wildlife|forest/i, 'trees'],
  [/english heritage|historic|castle|museum|cadw/i, 'castle'],
  [/zoo|theme park|merlin|cinema|odeon|cineworld|theatre/i, 'ticket'],
  [/gym|fitness|peloton|strava|yoga|pilates|swim/i, 'gym'],
  [/xbox|playstation|ps plus|nintendo|game/i, 'games'],
  [/icloud|google one|dropbox|onedrive|storage/i, 'cloud'],
  [/chatgpt|claude|openai|copilot/i, 'sparkles'],
  [/adobe|microsoft|office|software|app\b/i, 'laptop'],
  [/times|guardian|economist|newspaper|magazine|news/i, 'news'],
  [/hello ?fresh|gousto|mindful chef|graze|deliveroo|uber eats|just eat/i, 'food'],
  [/coffee|costa|pret/i, 'coffee'],
  [/train|rail|season ticket|tfl|oyster/i, 'train'],
  [/\bbus\b|coach/i, 'bus'],
  [/fuel|petrol|diesel/i, 'fuel'],
  [/\bcar\b|parking|\brac\b|\baa\b/i, 'car'],
  [/bike|cycle/i, 'bike'],
  [/electric|\bgas\b|energy|octopus|edf|ovo/i, 'energy'],
  [/water/i, 'water'],
  [/council tax|mortgage|rent/i, 'home'],
  [/nursery|childcare|kids|child/i, 'baby'],
  [/school|tuition|course/i, 'school'],
  [/vet|pet|dog|cat\b/i, 'pet'],
  [/haircut|hairdress|barber|salon/i, 'hair'],
  [/clothes|clothing/i, 'clothes'],
  [/charity|donation|sponsor/i, 'heart'],
  [/dentist|doctor|health|bupa|vitality|prescription/i, 'health'],
  [/grocer|supermarket|tesco|sainsbury|asda|ocado|waitrose/i, 'shopping'],
  [/amazon|delivery/i, 'box'],
]

/** The icon a bill shows: the one chosen for it, or a guess from its name. */
export function iconKey(label: string, chosen?: string, fallback = 'bill'): string {
  if (chosen && ITEM_ICONS[chosen]) return chosen
  return GUESSES.find(([re]) => re.test(label))?.[1] ?? fallback
}

export function ItemIcon({ label, chosen, fallback, size = 19 }: { label: string; chosen?: string; fallback?: string; size?: number }) {
  const { Icon } = ITEM_ICONS[iconKey(label, chosen, fallback)]
  return <Icon size={size} aria-hidden="true" />
}

/** A grid of icons to choose from, with "Automatic" to go back to Budge's guess. */
export function IconPicker({ label, value, onChange }: { label: string; value?: string; onChange: (key: string | undefined) => void }) {
  const guess = iconKey(label)
  const Guess = ITEM_ICONS[guess].Icon
  const cell = (on: boolean) => `aspect-square rounded-xl grid place-items-center cursor-pointer border ${on ? 'bg-ink text-on-ink border-ink' : 'bg-panel text-ink-2 border-line-2'}`
  return (
    <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Icon">
      <button role="radio" aria-checked={!value} aria-label={`Automatic (${ITEM_ICONS[guess].label})`} title="Automatic" onClick={() => onChange(undefined)} className={`${cell(!value)} relative`}>
        <Guess size={20} aria-hidden="true" />
        <span className={`absolute bottom-0.5 text-[9px] font-semibold ${!value ? 'text-on-ink' : 'text-muted'}`}>AUTO</span>
      </button>
      {Object.entries(ITEM_ICONS).map(([k, { Icon, label: l }]) => (
        <button key={k} role="radio" aria-checked={value === k} aria-label={l} title={l} onClick={() => onChange(k)} className={cell(value === k)}>
          <Icon size={20} aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}
