import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class KnowledgeBaseService {
  constructor() {
    this.careerData = [];
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    console.log('Initializing knowledge base...');
    
    // Load O*NET career data
    await this.loadCareerData();
    
    this.isInitialized = true;
    console.log('✓ Knowledge base initialized');
  }

  async loadCareerData() {
    // Create sample O*NET-style career data
    this.careerData = [
      {
        id: '15-1252.00',
        title: 'Software Developers, Applications',
        description: 'Develop, create, and modify general computer applications software or specialized utility programs.',
        tasks: [
          'Analyze user needs and software requirements',
          'Design, develop and test operating systems-level software',
          'Monitor functioning of equipment to ensure system operates in conformance with specifications'
        ],
        skills: ['Programming', 'Systems Analysis', 'Critical Thinking', 'Complex Problem Solving'],
        education: 'Bachelor\'s degree',
        salary: '$107,510',
        growth: '22% (Much faster than average)',
        workEnvironment: 'Office setting, collaborative teams, flexible hours',
        keywords: ['programming', 'software', 'development', 'coding', 'applications', 'systems']
      },
      {
        id: '15-1244.00',
        title: 'Network and Computer Systems Administrators',
        description: 'Install, configure, and maintain an organization\'s local area network (LAN), wide area network (WAN), data communications network, internet systems, and computer systems.',
        tasks: [
          'Monitor network performance to determine if adjustments need to be made',
          'Install and maintain network hardware and software',
          'Analyze equipment performance records to determine the need for repair or replacement'
        ],
        skills: ['Systems Administration', 'Network Security', 'Troubleshooting', 'Technical Support'],
        education: 'Bachelor\'s degree or equivalent experience',
        salary: '$84,810',
        growth: '4% (As fast as average)',
        workEnvironment: 'Office and server rooms, on-call availability, problem-solving focus',
        keywords: ['network', 'systems', 'administration', 'security', 'infrastructure', 'support']
      },
      {
        id: '15-1299.08',
        title: 'Computer Systems Engineers/Architects',
        description: 'Design and develop solutions to complex applications problems, system administration issues, or network concerns.',
        tasks: [
          'Design system architecture and integration points',
          'Evaluate system performance and recommend improvements',
          'Collaborate with development teams on technical solutions'
        ],
        skills: ['System Design', 'Architecture Planning', 'Technical Leadership', 'Integration'],
        education: 'Bachelor\'s degree in Computer Science or Engineering',
        salary: '$116,780',
        growth: '5% (As fast as average)',
        workEnvironment: 'Collaborative office environment, strategic planning, technical leadership',
        keywords: ['architecture', 'systems', 'design', 'engineering', 'leadership', 'integration']
      },
      {
        id: '15-1134.00',
        title: 'Web Developers',
        description: 'Design and create websites. May be responsible for the site\'s technical aspects, such as its performance and capacity.',
        tasks: [
          'Design and develop websites and web applications',
          'Write well designed, testable, efficient code',
          'Integrate data from various back-end services and databases'
        ],
        skills: ['Web Development', 'HTML/CSS', 'JavaScript', 'User Experience Design'],
        education: 'Associate degree or equivalent experience',
        salary: '$77,200',
        growth: '8% (Much faster than average)',
        workEnvironment: 'Creative environment, client interaction, project-based work',
        keywords: ['web', 'frontend', 'backend', 'javascript', 'html', 'css', 'websites']
      },
      {
        id: '15-1121.00',
        title: 'Computer Systems Analysts',
        description: 'Analyze science, engineering, business, and other data processing problems to implement and improve computer systems.',
        tasks: [
          'Analyze data processing problems to improve computer systems',
          'Study current computer systems and procedures',
          'Design solutions to help organizations operate more efficiently'
        ],
        skills: ['Systems Analysis', 'Problem Solving', 'Business Analysis', 'Technical Communication'],
        education: 'Bachelor\'s degree',
        salary: '$93,730',
        growth: '7% (Faster than average)',
        workEnvironment: 'Business environment, cross-functional collaboration, analytical work',
        keywords: ['analysis', 'systems', 'business', 'data', 'efficiency', 'solutions']
      }
    ];
  }

  async searchCareers(query, limit = 5) {
    if (!this.isInitialized) await this.initialize();
    
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(' ').filter(word => word.length > 2);
    
    // Calculate similarities based on keyword matching
    const similarities = this.careerData.map(career => {
      let score = 0;
      
      // Check title match
      if (career.title.toLowerCase().includes(queryLower)) {
        score += 0.5;
      }
      
      // Check description match
      if (career.description.toLowerCase().includes(queryLower)) {
        score += 0.3;
      }
      
      // Check keyword matches
      const keywordMatches = career.keywords.filter(keyword => 
        queryWords.some(word => keyword.includes(word) || word.includes(keyword))
      );
      score += keywordMatches.length * 0.2;
      
      // Check skills match
      const skillMatches = career.skills.filter(skill => 
        queryWords.some(word => skill.toLowerCase().includes(word))
      );
      score += skillMatches.length * 0.1;
      
      return {
        ...career,
        similarity: Math.min(score, 1.0) // Cap at 1.0
      };
    });
    
    // Sort by similarity and return top results
    return similarities
      .filter(career => career.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  async getCareerInsights(persona, interests) {
    const query = `${persona.primary.name} ${interests.join(' ')} ${persona.primary.traits.join(' ')}`;
    const matches = await this.searchCareers(query, 3);
    
    return matches.map(match => ({
      title: match.title,
      match: Math.round(match.similarity * 100),
      description: match.description,
      keySkills: match.skills,
      education: match.education,
      salary: match.salary,
      growth: match.growth,
      workEnvironment: match.workEnvironment
    }));
  }
}

export const knowledgeBaseService = new KnowledgeBaseService();
