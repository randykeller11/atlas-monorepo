import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { pipeline } from '@xenova/transformers';
import csv from 'csv-parser';
import { createReadStream } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class KnowledgeBaseService {
  constructor() {
    this.embeddings = null;
    this.careerData = [];
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    console.log('Initializing knowledge base...');
    
    // Load embedding model
    this.embeddings = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    
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
        workEnvironment: 'Office setting, collaborative teams, flexible hours'
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
        workEnvironment: 'Office and server rooms, on-call availability, problem-solving focus'
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
        workEnvironment: 'Collaborative office environment, strategic planning, technical leadership'
      }
    ];

    // Generate embeddings for career data
    for (const career of this.careerData) {
      const text = `${career.title} ${career.description} ${career.skills.join(' ')}`;
      career.embedding = await this.embeddings(text, { pooling: 'mean', normalize: true });
    }
  }

  async searchCareers(query, limit = 5) {
    if (!this.isInitialized) await this.initialize();
    
    // Generate query embedding
    const queryEmbedding = await this.embeddings(query, { pooling: 'mean', normalize: true });
    
    // Calculate similarities
    const similarities = this.careerData.map(career => ({
      ...career,
      similarity: this.cosineSimilarity(queryEmbedding.data, career.embedding.data)
    }));
    
    // Sort by similarity and return top results
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  cosineSimilarity(a, b) {
    const dotProduct = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
    return dotProduct / (magnitudeA * magnitudeB);
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
