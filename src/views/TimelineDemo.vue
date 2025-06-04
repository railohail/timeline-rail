<template>
  <div class="simile-timeline-demo">
    <SimileTimelineViewer :events="timelineEvents" :center-date="centerDate" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SimileTimelineViewer from '@/components/SimileTimelineViewer.vue'

interface TimelineEvent {
  id: string
  title: string
  startDate: Date
  endDate?: Date
  description?: string
  color?: string
  isDuration?: boolean
  category?: string
  image?: string
  link?: string
}

const centerDate = ref(new Date('1963-11-22T13:00:00-06:00'))

// JFK Timeline events based on the SIMILE Timeline example
const timelineEvents = ref<TimelineEvent[]>([
  {
    id: '1',
    title: "'Bay of Pigs' Invasion",
    startDate: new Date('1961-05-20T00:00:00-06:00'),
    description: 'Failed invasion of Cuba by CIA-sponsored paramilitary groups.',
    color: '#e74c3c',
    category: 'politics',
  },
  {
    id: '2',
    title: 'Oswald moves to New Orleans',
    startDate: new Date('1963-05-01T00:00:00-06:00'),
    endDate: new Date('1963-06-01T00:00:00-06:00'),
    isDuration: true,
    description:
      'Oswald moves to New Orleans, and finds employment at the William B. Riley Coffee Company.',
    color: '#f39c12',
    category: 'investigation',
  },
  {
    id: '3',
    title: 'General Walker shot',
    startDate: new Date('1963-05-10T00:00:00-06:00'),
    description: 'General Walker shot at in his home.',
    color: '#e74c3c',
    category: 'violence',
  },
  {
    id: '4',
    title: 'Kennedy, Johnson, Connelly met',
    startDate: new Date('1963-06-05T00:00:00-06:00'),
    description:
      'Decision for Texas trip made at meeting with Kennedy, Johnson, and Connelly at the Cortez hotel in El Paso Texas.',
    color: '#3498db',
    category: 'politics',
  },
  {
    id: '5',
    title: 'Maurice Bishop seen speaking to Oswald',
    startDate: new Date('1963-09-25T00:00:00-06:00'),
    description:
      'Antonio Veciana travels to Dallas for a meeting with Maurice Bishop (a.k.a. David Atlee Phillips). In the lobby of the Southland building, Veciana sees Bishop speaking to a man Veciana later identifies as Lee Harvey Oswald.',
    color: '#9b59b6',
    category: 'investigation',
  },
  {
    id: '6',
    title: "CIA's growth a malignancy",
    startDate: new Date('1963-10-01T00:00:00-06:00'),
    description:
      'Reporter Arthur Krock writes: "The CIA\'s growth was likened to a malignancy which the very high official was not sure even the White House could control any longer."',
    color: '#34495e',
    category: 'politics',
  },
  {
    id: '7',
    title: 'Kennedy signs NSAM 263',
    startDate: new Date('1963-10-11T00:00:00-06:00'),
    description:
      'Kennedy signs National Security Action Memorandum (NSAM) #263, signalling his intention to withdraw troops from Vietnam.',
    color: '#27ae60',
    category: 'politics',
  },
  {
    id: '8',
    title: 'Oswald begins job at TSBD',
    startDate: new Date('1963-10-16T00:00:00-06:00'),
    description:
      'Oswald begins job at Texas School Book Depository. He reportedly obtained it through a contact of Ruth Paine.',
    color: '#f39c12',
    category: 'investigation',
  },
  {
    id: '9',
    title: 'Oswald purchased rifle',
    startDate: new Date('1963-10-23T00:00:00-06:00'),
    description: "Ruth Paine makes notation on her calendar 'LHO purchase of rifle.'",
    color: '#e74c3c',
    category: 'investigation',
  },
  {
    id: '10',
    title: 'Lawson receives Texas trip schedule',
    startDate: new Date('1963-11-08T00:00:00-06:00'),
    description:
      'SS Agent Winston Lawson is briefed and receives a tentative schedule of Texas trip from SS Agent Roy H Kellerman.',
    color: '#3498db',
    category: 'security',
  },
  {
    id: '11',
    title: 'Governor Connelly confirms trip',
    startDate: new Date('1963-11-08T00:00:00-06:00'),
    description: 'Governor Connelly confirms trip to Dallas on November 21 - 22, 1963.',
    color: '#3498db',
    category: 'politics',
  },
  {
    id: '12',
    title: 'Oswald writes to Mr. Hunt',
    startDate: new Date('1963-11-08T00:00:00-06:00'),
    description:
      'Oswald writes to "Dear Mr. Hunt, I would like more information concerning my position. I am asking only for information."',
    color: '#9b59b6',
    category: 'investigation',
  },
  {
    id: '13',
    title: 'Oswald delivers note to Dallas FBI HQ',
    startDate: new Date('1963-11-08T00:00:00-06:00'),
    description:
      'Oswald delivers a note to Dallas FBI HQ where Agent James Hosty is told to destroy it by Special Agent in Charge, Gordon Shanklin.',
    color: '#e67e22',
    category: 'investigation',
  },
  {
    id: '14',
    title: 'SS Agents test-drive route',
    startDate: new Date('1963-11-14T00:00:00-06:00'),
    description:
      'SS Agents Lawson and Sorrels drive route from Lovefield to Trademart which went down Main street to Stemmons freeway.',
    color: '#3498db',
    category: 'security',
  },
  {
    id: '15',
    title: 'Motorcade route reviewed, unchanged',
    startDate: new Date('1963-11-15T00:00:00-06:00'),
    description: 'Motorcade route reviewed but was unchanged.',
    color: '#3498db',
    category: 'security',
  },
  {
    id: '16',
    title: 'Dallas Times Herald reports route',
    startDate: new Date('1963-11-16T00:00:00-06:00'),
    description:
      'Dallas Times Herald reported that the Presidential motorcade "apparently will loop through downtown area, probably on Main street on its way to Trade Mart".',
    color: '#16a085',
    category: 'media',
  },
  {
    id: '17',
    title: 'FBI calls to determine potential threat',
    startDate: new Date('1963-11-17T00:00:00-06:00'),
    description:
      'An FBI teletype is received, directed to all field offices to contact CIs (confidential informants) to determine whether a revolutionary group was a potential threat to the president.',
    color: '#e67e22',
    category: 'security',
  },
  {
    id: '18',
    title: 'Motorcade timing verified',
    startDate: new Date('1963-11-18T00:00:00-06:00'),
    description:
      'SS Agents Lawson and Sorrels with Dallas police assistant Chief Charles Batchelor drive motorcade route verifying that it could be driven in 45 minutes.',
    color: '#3498db',
    category: 'security',
  },
  {
    id: '19',
    title: 'Newspaper published precise route',
    startDate: new Date('1963-11-19T00:00:00-06:00'),
    description:
      'Newspaper published precise route mentioning the turn into Elm into Houston then onto the freeway.',
    color: '#16a085',
    category: 'media',
  },
  {
    id: '20',
    title: 'Mock target practice witnessed',
    startDate: new Date('1963-11-20T00:00:00-06:00'),
    description:
      'Two Dallas police officers witness a "mock target practice" going on at the picket fence atop the knoll.',
    color: '#e74c3c',
    category: 'investigation',
  },
  {
    id: '21',
    title: 'Rose Cheramie warns of assassination',
    startDate: new Date('1963-11-20T00:00:00-06:00'),
    description:
      'Rose Cheramie is thrown from a car, taken to hospital, and while there tells doctors that JFK is going to be killed in Dallas.',
    color: '#e74c3c',
    category: 'warning',
  },
  {
    id: '22',
    title: 'Bundy signs 1st draft of NSAM 273',
    startDate: new Date('1963-11-21T00:00:00-06:00'),
    description:
      'McGeorge Bundy, then assistant to President Kennedy, signs the key first draft of NSAM 273, in contradiction to all previous Kennedy policy.',
    color: '#34495e',
    category: 'politics',
  },
  {
    id: '23',
    title: 'Man with rifle spotted on Elm St.',
    startDate: new Date('1963-11-22T11:00:00-06:00'),
    description:
      'Julia Ann Mercer drives down Elm street, her way is blocked by a green Ford pickup truck. A young man removes a long paper bag with the outline of a rifle.',
    color: '#e74c3c',
    category: 'investigation',
  },
  {
    id: '24',
    title: 'Air Force One leaves Fort Worth',
    startDate: new Date('1963-11-22T11:10:00-06:00'),
    description:
      'Air Force One leaves Carswell AFB Fort Worth for 13 min flight to Lovefield Airport.',
    color: '#3498db',
    category: 'travel',
  },
  {
    id: '25',
    title: 'Motorcade leaves Lovefield Airport',
    startDate: new Date('1963-11-22T11:30:00-06:00'),
    description: 'Presidential Motorcade leaves Lovefield Airport.',
    color: '#3498db',
    category: 'travel',
    image: 'motorcade.png',
  },
  {
    id: '26',
    title: 'Motorcade arrives at Love Field',
    startDate: new Date('1963-11-22T11:45:00-06:00'),
    description: 'The presidential motorcade arrives at Love Field airport in Dallas.',
    color: '#27ae60',
    category: 'travel',
  },
  {
    id: '27',
    title: 'JFK Assassination',
    startDate: new Date('1963-11-22T12:30:00-06:00'),
    description: 'President John F. Kennedy is assassinated in Dealey Plaza, Dallas, Texas.',
    color: '#c0392b',
    category: 'assassination',
  },
  {
    id: '28',
    title: 'JFK pronounced dead',
    startDate: new Date('1963-11-22T13:00:00-06:00'),
    description: 'President Kennedy is pronounced dead at Parkland Hospital.',
    color: '#8b0000',
    category: 'assassination',
  },
  {
    id: '29',
    title: 'Oswald arrested',
    startDate: new Date('1963-11-22T13:15:00-06:00'),
    description: 'Lee Harvey Oswald is arrested at the Texas Theatre.',
    color: '#f39c12',
    category: 'investigation',
  },
  {
    id: '30',
    title: 'Johnson sworn in as President',
    startDate: new Date('1963-11-22T14:38:00-06:00'),
    description:
      'Lyndon B. Johnson is sworn in as the 36th President of the United States aboard Air Force One.',
    color: '#2980b9',
    category: 'politics',
  },
])
</script>

<style scoped>
.simile-timeline-demo {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}
</style>
