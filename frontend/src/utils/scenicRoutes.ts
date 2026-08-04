export interface ScenicAttraction {
  name: string;
  description: string;
  idealSideUp: 'LEFT' | 'RIGHT' | 'BOTH'; // UP means traveling from sequence 1 -> 18
  startSeq: number;
  endSeq: number;
  imageUrl: string;
}

export const SCENIC_ATTRACTIONS: ScenicAttraction[] = [
  {
    name: 'Balana Pass & Kadugannawa',
    description: 'Steep incline with sweeping views of the low country.',
    idealSideUp: 'LEFT',
    startSeq: 6, // Rambukkana
    endSeq: 8,   // Kandy
    imageUrl: 'https://images.unsplash.com/photo-1579730561578-1a52862d3a39?auto=format&fit=crop&q=80&w=600', // green hills train
  },
  {
    name: 'St. Clair\'s & Devon Falls',
    description: 'Famous twin waterfalls cascading through lush tea estates.',
    idealSideUp: 'RIGHT',
    startSeq: 10, // Hatton
    endSeq: 11,   // Nanu Oya
    imageUrl: 'https://images.unsplash.com/photo-1620606990499-d41c4840d8aa?auto=format&fit=crop&q=80&w=600', // waterfall tea estate
  },
  {
    name: 'Horton Plains & Pine Forests',
    description: 'High altitude plains, misty pine forests, and Summit point.',
    idealSideUp: 'BOTH',
    startSeq: 11, // Nanu Oya
    endSeq: 14,   // Haputale
    imageUrl: 'https://images.unsplash.com/photo-1549474742-0056972740fc?auto=format&fit=crop&q=80&w=600', // foggy forest
  },
  {
    name: 'Haputale Gap & Thangamale',
    description: 'Incredible sheer drop into the southern plains and bird sanctuary.',
    idealSideUp: 'RIGHT',
    startSeq: 14, // Haputale
    endSeq: 17,   // Ella
    imageUrl: 'https://images.unsplash.com/photo-1548489709-612fb8ce9019?auto=format&fit=crop&q=80&w=600', // wide mountain drop
  },
  {
    name: 'Demodara Nine Arch Bridge',
    description: 'The iconic colonial-era railway bridge and Demodara Loop.',
    idealSideUp: 'LEFT',
    startSeq: 17, // Ella
    endSeq: 18,   // Badulla
    imageUrl: 'https://images.unsplash.com/photo-1563852079040-e1cbfa2a9eb5?auto=format&fit=crop&q=80&w=600', // nine arch bridge
  }
];

export interface ScenicRecommendation {
  attractions: ScenicAttraction[];
  bestSide: 'LEFT' | 'RIGHT' | 'BOTH' | 'NONE';
}

export const getScenicRecommendations = (originSeq: number, destSeq: number): ScenicRecommendation => {
  if (originSeq === destSeq) return { attractions: [], bestSide: 'NONE' };

  const isGoingUp = originSeq < destSeq;
  const lowerSeq = Math.min(originSeq, destSeq);
  const upperSeq = Math.max(originSeq, destSeq);

  const visibleAttractions = SCENIC_ATTRACTIONS.filter(
    (attr) => attr.startSeq < upperSeq && attr.endSeq > lowerSeq
  );

  if (visibleAttractions.length === 0) {
    return { attractions: [], bestSide: 'NONE' };
  }

  let leftVotes = 0;
  let rightVotes = 0;

  visibleAttractions.forEach(attr => {
    // If going DOWN (Badulla -> Colombo), the sides flip
    let side = attr.idealSideUp;
    if (!isGoingUp) {
      if (side === 'LEFT') side = 'RIGHT';
      else if (side === 'RIGHT') side = 'LEFT';
    }

    if (side === 'LEFT') leftVotes++;
    if (side === 'RIGHT') rightVotes++;
  });

  let bestSide: 'LEFT' | 'RIGHT' | 'BOTH' = 'BOTH';
  if (leftVotes > rightVotes) bestSide = 'LEFT';
  else if (rightVotes > leftVotes) bestSide = 'RIGHT';

  return {
    attractions: visibleAttractions,
    bestSide
  };
};
