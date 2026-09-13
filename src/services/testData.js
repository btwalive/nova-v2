export const INTRO_SECTION_FRESHER = {
  id: "sec_intro_fresher",
  title: "Section 1: Introductory & Career Intent",
  instructions: "Answer each question directly in spoken English. You have up to 45 seconds per response.",
  type: "speaking",
  questions: [
    {
      id: "q_intro_f1",
      questionText: "Tell me about yourself",
      promptText: "Please introduce yourself, your educational background, and your key strengths.",
      prepTimeSeconds: 5,
      maxRecordingSeconds: 45
    },
    {
      id: "q_intro_f2",
      questionText: "Why do you want to join the BPO industry?",
      promptText: "Why do you want to join the BPO / Customer Care industry, and why are you a good fit for this role?",
      prepTimeSeconds: 5,
      maxRecordingSeconds: 45
    }
  ]
};

export const INTRO_SECTION_EXPERIENCED = {
  id: "sec_intro_exp",
  title: "Section 1: Work Experience & KRAs (Experienced)",
  instructions: "Describe your professional experience clearly in spoken English. You will have up to 45 seconds per response.",
  type: "speaking",
  questions: [
    {
      id: "q_intro_e1",
      questionText: "Professional Work Experience Overview",
      promptText: "Please introduce yourself and describe your past work experience, including all the companies you have worked for and your key roles.",
      prepTimeSeconds: 5,
      maxRecordingSeconds: 45
    },
    {
      id: "q_intro_e2",
      questionText: "KPIs and Key Result Areas (KRAs)",
      promptText: "Explain your Key Performance Indicators (KPIs) and Key Result Areas (KRAs) in your previous roles and how you consistently achieved your targets.",
      prepTimeSeconds: 5,
      maxRecordingSeconds: 45
    }
  ]
};

export const CORE_SECTIONS = [
  {
    id: "sec_reading",
    title: "Section 2: Reading Aloud & Passage Articulation",
    instructions: "Read the passage displayed below out loud into your microphone with clear pronunciation, correct pacing, and natural intonation.",
    type: "reading",
    questions: [
      {
        id: "q_read_1",
        promptText: "Effective communication is essential for building strong professional relationships. When interacting with clients, active listening is just as important as speaking clearly. Always confirm details politely and summarize action items before ending a call."
      },
      {
        id: "q_read_2",
        promptText: "Quality customer support requires patience, empathy, and problem-solving skills. When a customer faces a technical issue, acknowledge their concern promptly, maintain a calm tone, and provide clear step-by-step guidance to resolve their query."
      },
      {
        id: "q_read_3",
        promptText: "Teamwork and collaboration drive organizational success. By sharing knowledge and supporting colleagues during peak operational hours, teams achieve higher performance standards and deliver outstanding service to customers worldwide."
      }
    ]
  },
  {
    id: "sec_listen_repeat",
    title: "Section 3: Listen & Repeat Sentences",
    instructions: "Click 'Play Sentence Audio' to listen to each spoken sentence, then repeat it out loud accurately into your microphone.",
    type: "listen_repeat",
    questions: [
      {
        id: "q_lr_1",
        audioText: "Thank you for calling customer support. How may I assist you with your account today?",
        audioUrl: "/audio/prompts/lr_sentence_1.mp3"
      },
      {
        id: "q_lr_2",
        audioText: "Please hold the line while I retrieve your billing details from our database.",
        audioUrl: "/audio/prompts/lr_sentence_2.mp3"
      },
      {
        id: "q_lr_3",
        audioText: "We sincerely apologize for the inconvenience and will resolve this issue immediately.",
        audioUrl: "/audio/prompts/lr_sentence_3.mp3"
      }
    ]
  },
  {
    id: "sec_audio_story",
    title: "Section 4: Listening Comprehension & Spoken Recall",
    instructions: "Listen to the short audio passage story carefully, then answer the comprehension question out loud into your microphone.",
    type: "audio_comprehension",
    passageAudioText: "Mr. Smith called customer care on Tuesday morning regarding a delayed shipment order number 408. The support specialist, John, verified his account, found that the package was delayed due to severe weather, and arranged priority delivery by Thursday evening.",
    passageAudioUrl: "/audio/prompts/story_passage.mp3",
    questions: [
      {
        id: "q_story_1",
        questionText: "Why did Mr. Smith call customer care and when did John promise priority delivery?"
      },
      {
        id: "q_story_2",
        questionText: "What was the reason for the shipment delay and what action did the support specialist take?"
      }
    ]
  },
  {
    id: "sec_extempore",
    title: "Section 5: Extempore & Impromptu Topic Speaking",
    instructions: "Read the topic prompt below. You will have 15 seconds to prepare your thoughts, after which voice recording will start automatically.",
    type: "extempore",
    questions: [
      {
        id: "q_ext_1",
        topicTitle: "Handling an Upset Customer under Pressure",
        promptText: "Describe a situation where a customer or colleague is dissatisfied. How would you handle the conversation professionally to turn their negative experience into a positive one?",
        prepTimeSeconds: 15,
        maxRecordingSeconds: 60
      }
    ]
  }
];

export const INITIAL_TESTS = {
  "8d5ri83f9c": {
    id: "8d5ri83f9c",
    title: "Nova Spoken Communication & Voice Skills Assessment",
    category: "Voice Assessment",
    durationMinutes: 15,
    sections: CORE_SECTIONS
  }
};
