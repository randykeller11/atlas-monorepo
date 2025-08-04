import { getSession } from './sessionService.js';

// Placeholder for resume generation service
export class ResumeService {
  constructor() {
    this.templates = {
      student: 'student-resume-template',
      professional: 'professional-resume-template',
      career_change: 'career-change-template'
    };
  }

  async generateResume(sessionId, options = {}) {
    console.log(`Resume generation requested for session ${sessionId}`);
    
    const session = await getSession(sessionId);
    const personaCard = session.enrichedPersona || session.persona;
    
    if (!personaCard) {
      throw new Error('No persona data available for resume generation');
    }
    
    // Use AI to generate resume content based on persona
    const resumePrompt = `Generate a professional resume based on this persona:
    
    Persona: ${personaCard.archetypeName || personaCard.primary?.name}
    Strengths: ${(personaCard.topStrengths || personaCard.primary?.traits || []).join(', ')}
    Target Role: ${options.targetRole || 'Software Engineer'}
    Experience Level: ${options.experience || 'mid-level'}
    
    Generate realistic resume content including:
    - Professional summary
    - Work experience (2-3 positions)
    - Skills section
    - Education
    - Projects (2-3 relevant projects)
    
    Format as JSON with sections: personalInfo, summary, experience, skills, education, projects`;
    
    try {
      const { aiRequest } = await import('./aiService.js');
      const response = await aiRequest(sessionId, resumePrompt, {
        systemInstructions: 'Generate realistic, professional resume content based on the persona. Return valid JSON.',
        expectedSchema: 'json_object'
      });
      
      let resumeData;
      try {
        resumeData = JSON.parse(response.content);
      } catch {
        // Fallback to structured data if AI doesn't return JSON
        resumeData = this.generateFallbackResume(personaCard, options);
      }
      
      return {
        sessionId,
        generatedAt: new Date().toISOString(),
        template: options.template || 'professional',
        data: resumeData,
        persona: personaCard.archetypeName || personaCard.primary?.name,
        status: 'generated'
      };
      
    } catch (error) {
      console.error('Error generating AI resume:', error);
      return this.generateFallbackResume(personaCard, options);
    }
  }

  generateFallbackResume(personaCard, options) {
    return {
      sessionId: personaCard.sessionId,
      generatedAt: new Date().toISOString(),
      template: options.template || 'professional',
      data: {
        personalInfo: {
          name: 'Professional Name',
          email: 'professional@email.com',
          phone: '(555) 123-4567',
          location: 'City, State',
          linkedin: 'linkedin.com/in/professional'
        },
        summary: personaCard.elevatorPitch || personaCard.shortDescription || 'Results-driven professional with strong technical capabilities.',
        experience: [
          {
            title: options.targetRole || 'Software Engineer',
            company: 'Tech Company',
            duration: '2021 - Present',
            achievements: [
              'Led development of scalable applications',
              'Collaborated with cross-functional teams',
              'Implemented best practices and code reviews'
            ]
          }
        ],
        skills: personaCard.topStrengths || personaCard.primary?.traits || ['Problem Solving', 'Technical Skills', 'Communication'],
        education: [
          {
            degree: 'Bachelor of Science in Computer Science',
            school: 'University Name',
            year: '2020'
          }
        ],
        projects: [
          {
            name: 'Portfolio Project',
            description: 'Built a comprehensive application demonstrating technical skills',
            technologies: ['JavaScript', 'React', 'Node.js']
          }
        ]
      },
      persona: personaCard.archetypeName || personaCard.primary?.name,
      status: 'generated'
    };
  }

  getPersonaSummary(persona) {
    if (!persona) return null;
    
    return {
      type: persona.primary?.key || 'unknown',
      name: persona.primary?.name || 'Unknown',
      confidence: persona.primary?.confidence || 0,
      traits: persona.primary?.traits || [],
      summary: persona.summary || []
    };
  }

  selectTemplate(session) {
    // Logic to select appropriate template based on session data
    if (session.totalQuestions < 5) {
      return this.templates.student;
    }
    
    if (session.persona?.primary?.key === 'explorer') {
      return this.templates.career_change;
    }
    
    return this.templates.professional;
  }

  async getResumeTemplates() {
    return Object.keys(this.templates).map(key => ({
      id: key,
      name: this.formatTemplateName(key),
      description: this.getTemplateDescription(key)
    }));
  }

  formatTemplateName(templateKey) {
    return templateKey.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  getTemplateDescription(templateKey) {
    const descriptions = {
      student: 'Optimized for students and recent graduates',
      professional: 'Standard professional resume format',
      career_change: 'Designed for career transition and exploration'
    };
    
    return descriptions[templateKey] || 'Resume template';
  }

  async mergePersonaData(resumeData, personaData) {
    // Placeholder for merging persona insights into resume
    return {
      ...resumeData,
      personalityInsights: personaData,
      careerFit: personaData?.archetype?.careerFit || [],
      keyStrengths: personaData?.archetype?.traits || []
    };
  }

  async generateCareerSummary(sessionId) {
    const session = await getSession(sessionId);
    
    // Placeholder career summary based on assessment
    return {
      sessionId: sessionId,
      summary: "Career summary will be generated based on assessment responses",
      keyInsights: [
        "Insight 1 based on assessment",
        "Insight 2 based on persona",
        "Insight 3 based on preferences"
      ],
      recommendedPaths: [
        "Career path 1",
        "Career path 2",
        "Career path 3"
      ],
      nextSteps: [
        "Complete the full assessment",
        "Explore recommended career paths",
        "Connect with career counselors"
      ]
    };
  }
}

// Export singleton instance
export const resumeService = new ResumeService();

// Convenience functions
export async function generateResume(sessionId, options) {
  return await resumeService.generateResume(sessionId, options);
}

export async function getResumeTemplates() {
  return await resumeService.getResumeTemplates();
}

export async function generateCareerSummary(sessionId) {
  return await resumeService.generateCareerSummary(sessionId);
}
