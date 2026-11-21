import { useT } from '../i18n';
import { useSettings } from '../store/settings';

interface Topic {
  icon: string;
  title: string;
  body: string;
  tip?: string;
}

const EL: Topic[] = [
  { icon: '💰', title: 'Κεφαλαιοποίηση (Market cap)', body: 'Τιμή × κυκλοφορούσα ποσότητα. Δείχνει πόσο «μεγάλο» είναι ένα νόμισμα. Τα μεγάλα (Bitcoin, Ethereum) κινούνται πιο ήρεμα, τα μικρά μπορούν να ανέβουν ή να πέσουν πολύ γρήγορα.', tip: 'Μια χαμηλή τιμή ανά νόμισμα ΔΕΝ σημαίνει ότι είναι «φθηνό». Κοίτα πάντα την κεφαλαιοποίηση.' },
  { icon: '📊', title: 'Όγκος (Volume)', body: 'Πόσα χρήματα άλλαξαν χέρια τις τελευταίες 24 ώρες. Μεγάλος όγκος σημαίνει ότι πολλοί συμμετέχουν και η κίνηση της τιμής είναι πιο «αληθινή».', tip: 'Άνοδος με μικρό όγκο είναι συχνά αδύναμη και μπορεί να μην κρατήσει.' },
  { icon: '🕯️', title: 'Κεριά (Candlesticks)', body: 'Κάθε κερί δείχνει μια χρονική περίοδο (π.χ. 1 ώρα ή 1 ημέρα): τιμή ανοίγματος, κλεισίματος, υψηλό και χαμηλό. Πράσινο = έκλεισε πιο ψηλά από ό,τι άνοιξε, κόκκινο = πιο χαμηλά.', tip: 'Άλλαξε το χρονικό πλαίσιο (15m, 1H, 4H, 1D, 1W) για να δεις βραχυπρόθεσμη ή μακροπρόθεσμη εικόνα.' },
  { icon: '🧭', title: 'Τεχνική αξιολόγηση (Rating)', body: 'Το CryptoIntel τρέχει 16 δείκτες σε κάθε νόμισμα. Κάθε δείκτης «ψηφίζει» Buy, Ουδέτερο ή Sell, και ο μέσος όρος δίνει το τελικό rating: από Ισχυρό Sell έως Ισχυρό Buy.', tip: 'Το rating περιγράφει τι έκανε η τιμή μέχρι τώρα — δεν προβλέπει το μέλλον. Χρησιμοποίησέ το σαν πυξίδα, όχι σαν εντολή.' },
  { icon: '⚡', title: 'RSI', body: 'Μετράει πόσο γρήγορα κινήθηκε η τιμή, από 0 έως 100. Κάτω από 30 = «υπερπουλημένο» (έπεσε πολύ γρήγορα). Πάνω από 70 = «υπεραγορασμένο» (ανέβηκε πολύ γρήγορα).' },
  { icon: '〰️', title: 'Κινητοί μέσοι όροι (MA / EMA)', body: 'Η μέση τιμή των τελευταίων Ν κεριών. Όταν η τιμή είναι πάνω από τον μέσο όρο, οι αγοραστές έχουν τον έλεγχο. Ο EMA 200 θεωρείται η «διαχωριστική γραμμή» μεταξύ ανοδικής και πτωτικής αγοράς.' },
  { icon: '🌀', title: 'MACD', body: 'Συγκρίνει έναν γρήγορο και έναν αργό μέσο όρο. Όταν η γραμμή MACD περνάει πάνω από τη γραμμή σήματος, η ορμή γυρίζει ανοδική — και το αντίθετο.' },
  { icon: '🎯', title: 'Bollinger Bands', body: 'Δύο ζώνες γύρω από τον μέσο όρο που ανοίγουν όταν η αγορά έχει νεύρα και κλείνουν όταν ηρεμεί. Η τιμή έξω από τις ζώνες είναι ασυνήθιστη και συχνά επιστρέφει.' },
  { icon: '🧱', title: 'Στήριξη & αντίσταση', body: 'Στήριξη: επίπεδο όπου η τιμή συνήθως σταματά να πέφτει. Αντίσταση: επίπεδο όπου συνήθως σταματά να ανεβαίνει. Στη σελίδα κάθε νομίσματος θα βρεις τα επίπεδα S1/S2 και R1/R2.' },
  { icon: '😨', title: 'Fear & Greed', body: 'Ένας δείκτης 0–100 για το συναίσθημα της αγοράς. Ο ακραίος φόβος συχνά συμπίπτει με χαμηλά, η ακραία απληστία με κορυφές.', tip: '«Να είσαι φοβισμένος όταν οι άλλοι είναι άπληστοι, και άπληστος όταν οι άλλοι φοβούνται.»' },
  { icon: '🛡️', title: 'Ρίσκο & μεταβλητότητα', body: 'Το ρίσκο υπολογίζεται από το πόσο κινείται η τιμή ανά κερί (ATR) και το μέγεθος του νομίσματος. Υψηλό ρίσκο = μεγάλες, γρήγορες κινήσεις και προς τις δύο κατευθύνσεις.' },
  { icon: '📝', title: 'Ημερολόγιο & σημειώσεις', body: 'Πριν αγοράσεις ή πουλήσεις, γράψε μια σημείωση: τι βλέπεις και τι περιμένεις (ανοδικό ή πτωτικό). Το CryptoIntel κρατάει την τιμή εκείνης της στιγμής και σου δείχνει αργότερα αν είχες δίκιο. Οι σημειώσεις και οι συναλλαγές σου εμφανίζονται και πάνω στο γράφημα.', tip: 'Οι επαγγελματίες traders κρατούν πάντα ημερολόγιο — είναι ο πιο γρήγορος τρόπος να βρεις τι δουλεύει για σένα και τι όχι.' },
  { icon: '🔔', title: 'Alerts & Portfolio', body: 'Βάλε alerts για να μη χρειάζεται να κοιτάς συνέχεια την οθόνη, και κατέγραψε τις αγορές/πωλήσεις σου στο Portfolio για να βλέπεις το πραγματικό σου κέρδος ή ζημία. Συνδέσου με Google για να τα έχεις σε όλες τις συσκευές.' },
];

const EN: Topic[] = [
  { icon: '💰', title: 'Market cap', body: 'Price × circulating supply. It tells you how "big" a coin is. Large caps (Bitcoin, Ethereum) move more calmly; small caps can rise or fall very fast.', tip: 'A low price per coin does NOT mean it is "cheap". Always look at market cap.' },
  { icon: '📊', title: 'Volume', body: 'How much money changed hands in the last 24 hours. High volume means many participants, so price moves are more meaningful.', tip: 'A rally on low volume is often weak and may not last.' },
  { icon: '🕯️', title: 'Candlesticks', body: 'Each candle covers one period (e.g. 1 hour or 1 day) and shows open, close, high and low. Green = closed higher than it opened, red = closed lower.', tip: 'Switch the timeframe (15m, 1H, 4H, 1D, 1W) for a short- or long-term view.' },
  { icon: '🧭', title: 'Technical rating', body: 'CryptoIntel runs 16 indicators on every coin. Each one votes Buy, Neutral or Sell, and the average becomes the final rating, from Strong Sell to Strong Buy.', tip: 'A rating describes what price has done so far — it does not predict the future. Use it as a compass, not a command.' },
  { icon: '⚡', title: 'RSI', body: 'Measures how fast price has moved, from 0 to 100. Below 30 = "oversold" (fell very fast). Above 70 = "overbought" (rose very fast).' },
  { icon: '〰️', title: 'Moving averages (MA / EMA)', body: 'The average price of the last N candles. When price is above its average, buyers are in control. The 200 EMA is widely seen as the line between bull and bear markets.' },
  { icon: '🌀', title: 'MACD', body: 'Compares a fast and a slow average. When the MACD line crosses above its signal line, momentum is turning up — and vice versa.' },
  { icon: '🎯', title: 'Bollinger Bands', body: 'Two bands around the average that widen when the market is nervous and tighten when it is calm. Price outside the bands is unusual and often snaps back.' },
  { icon: '🧱', title: 'Support & resistance', body: 'Support: a level where price tends to stop falling. Resistance: a level where it tends to stop rising. Each coin page shows S1/S2 and R1/R2 levels.' },
  { icon: '😨', title: 'Fear & Greed', body: 'A 0–100 index of market emotion. Extreme fear often coincides with bottoms, extreme greed with tops.', tip: '"Be fearful when others are greedy, and greedy when others are fearful."' },
  { icon: '🛡️', title: 'Risk & volatility', body: 'Risk is based on how much price moves per candle (ATR) and on coin size. High risk = big, fast moves in both directions.' },
  { icon: '📝', title: 'Journal & notes', body: 'Before you buy or sell, write a note: what you see and what you expect (bullish or bearish). CryptoIntel saves the price at that moment and later shows whether you were right. Your notes and trades also appear on the chart.', tip: 'Professional traders always keep a journal — it is the fastest way to learn what works for you and what does not.' },
  { icon: '🔔', title: 'Alerts & portfolio', body: 'Set alerts so you do not have to watch the screen, and log your buys and sells in Portfolio to see your real profit or loss. Sign in with Google to keep them on every device.' },
];

export function LearnPage() {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const topics = lang === 'el' ? EL : EN;
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('learn.title')}</h1>
          <p className="page-sub">{t('learn.subtitle')}</p>
        </div>
      </div>
      <div className="learn-grid">
        {topics.map((tp) => (
          <div key={tp.title} className="card learn-card">
            <h3><span className="learn-ico">{tp.icon}</span>{tp.title}</h3>
            <p>{tp.body}</p>
            {tp.tip && <div className="tip">💡 {tp.tip}</div>}
          </div>
        ))}
      </div>
      <div className="notice warn" style={{ marginTop: 20 }}>⚠️ {t('footer.disclaimer')}</div>
    </>
  );
}
