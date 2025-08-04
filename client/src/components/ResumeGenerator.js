import React, { useState } from 'react';
import './ResumeGenerator.css';

const ResumeGenerator = ({ onClose, personaCard, sessionId }) => {
  const [selectedTemplate, setSelectedTemplate] = useState('professional');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResume, setGeneratedResume] = useState(null);
  const [customizations, setCustomizations] = useState({
    targetRole: '',
    experience: 'entry-level',
    skills: [],
    education: ''
  });

  const templates = [
    {
      id: 'professional',
      name: 'Professional',
      description: 'Clean, traditional format perfect for corporate roles',
      preview: '/api/placeholder/300/400'
    },
    {
      id: 'modern',
      name: 'Modern',
      description: 'Contemporary design with visual elements for creative roles',
      preview: '/api/placeholder/300/400'
    },
    {
      id: 'technical',
      name: 'Technical',
      description: 'Optimized for engineering and technical positions',
      preview: '/api/placeholder/300/400'
    }
  ];

  // Generate fake resume data based on persona
  const generateResumeData = () => {
    const baseData = {
      personalInfo: {
        name: 'Randy Keller',
        email: 'randy.keller@email.com',
        phone: '(555) 123-4567',
        location: 'San Francisco, CA',
        linkedin: 'linkedin.com/in/randykeller'
      },
      summary: personaCard?.elevatorPitch || 'Results-driven professional with strong technical and leadership capabilities.',
      experience: [
        {
          title: 'Senior Software Engineer',
          company: 'TechCorp Solutions',
          duration: '2021 - Present',
          achievements: [
            'Led development of scalable microservices architecture serving 1M+ users',
            'Mentored team of 5 junior developers, improving code quality by 40%',
            'Implemented CI/CD pipeline reducing deployment time by 60%',
            'Collaborated with cross-functional teams to deliver 15+ major features'
          ]
        },
        {
          title: 'Software Engineer',
          company: 'StartupXYZ',
          duration: '2019 - 2021',
          achievements: [
            'Built full-stack web applications using React and Node.js',
            'Optimized database queries improving application performance by 35%',
            'Participated in agile development process and code reviews',
            'Contributed to open-source projects and technical documentation'
          ]
        }
      ],
      skills: personaCard?.topStrengths || [
        'JavaScript/TypeScript',
        'React & Node.js',
        'System Architecture',
        'Team Leadership',
        'Problem Solving',
        'Agile Development'
      ],
      education: [
        {
          degree: 'Bachelor of Science in Computer Science',
          school: 'University of California, Berkeley',
          year: '2019',
          gpa: '3.7/4.0'
        }
      ],
      projects: [
        {
          name: 'E-commerce Platform',
          description: 'Built scalable e-commerce solution with React, Node.js, and PostgreSQL',
          technologies: ['React', 'Node.js', 'PostgreSQL', 'AWS'],
          link: 'github.com/randykeller/ecommerce'
        },
        {
          name: 'Task Management App',
          description: 'Developed collaborative task management tool with real-time updates',
          technologies: ['Vue.js', 'Express', 'Socket.io', 'MongoDB'],
          link: 'github.com/randykeller/taskmanager'
        }
      ],
      certifications: [
        'AWS Certified Solutions Architect',
        'Certified Scrum Master (CSM)',
        'Google Cloud Professional Developer'
      ]
    };

    // Customize based on target role
    if (customizations.targetRole.toLowerCase().includes('manager')) {
      baseData.experience[0].achievements.unshift('Managed cross-functional team of 12 engineers across 3 product areas');
      baseData.skills.unshift('Team Management', 'Strategic Planning');
    }

    return baseData;
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    
    // Simulate API call
    setTimeout(() => {
      const resumeData = generateResumeData();
      setGeneratedResume(resumeData);
      setIsGenerating(false);
    }, 2000);
  };

  const handleDownload = (format) => {
    // Simulate download
    const element = document.createElement('a');
    const file = new Blob([JSON.stringify(generatedResume, null, 2)], {type: 'application/json'});
    element.href = URL.createObjectURL(file);
    element.download = `resume-${format}.json`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleCustomizationChange = (field, value) => {
    setCustomizations(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (generatedResume) {
    return (
      <div className="resume-overlay">
        <div className="resume-container">
          <div className="resume-header">
            <h2>🎉 Your Resume is Ready!</h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
          
          <div className="resume-preview">
            <div className="resume-document">
              <div className="resume-personal">
                <h1>{generatedResume.personalInfo.name}</h1>
                <div className="contact-info">
                  <span>{generatedResume.personalInfo.email}</span>
                  <span>{generatedResume.personalInfo.phone}</span>
                  <span>{generatedResume.personalInfo.location}</span>
                </div>
              </div>
              
              <div className="resume-section">
                <h3>Professional Summary</h3>
                <p>{generatedResume.summary}</p>
              </div>
              
              <div className="resume-section">
                <h3>Experience</h3>
                {generatedResume.experience.map((exp, index) => (
                  <div key={index} className="experience-item">
                    <div className="exp-header">
                      <h4>{exp.title}</h4>
                      <span className="duration">{exp.duration}</span>
                    </div>
                    <p className="company">{exp.company}</p>
                    <ul>
                      {exp.achievements.map((achievement, i) => (
                        <li key={i}>{achievement}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              
              <div className="resume-section">
                <h3>Skills</h3>
                <div className="skills-grid">
                  {generatedResume.skills.map((skill, index) => (
                    <span key={index} className="skill-tag">{skill}</span>
                  ))}
                </div>
              </div>
              
              <div className="resume-section">
                <h3>Education</h3>
                {generatedResume.education.map((edu, index) => (
                  <div key={index} className="education-item">
                    <h4>{edu.degree}</h4>
                    <p>{edu.school} • {edu.year}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="resume-actions">
            <div className="download-options">
              <h4>Download Options</h4>
              <div className="download-buttons">
                <button onClick={() => handleDownload('pdf')} className="download-btn pdf">
                  📄 Download PDF
                </button>
                <button onClick={() => handleDownload('docx')} className="download-btn docx">
                  📝 Download Word
                </button>
                <button onClick={() => handleDownload('txt')} className="download-btn txt">
                  📋 Plain Text
                </button>
              </div>
            </div>
            
            <div className="customization-options">
              <h4>Customize Further</h4>
              <div className="customize-buttons">
                <button className="customize-btn" onClick={() => setGeneratedResume(null)}>
                  ✏️ Edit Content
                </button>
                <button className="customize-btn">
                  🎨 Change Template
                </button>
                <button className="customize-btn">
                  🎯 Tailor for Role
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="resume-overlay">
      <div className="resume-container">
        <div className="resume-header">
          <h2>AI Resume Generator</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="resume-content">
          <div className="persona-integration">
            <h3>Based on Your Persona: {personaCard?.archetypeName}</h3>
            <p>We'll use your strengths and suggested roles to create a targeted resume.</p>
            <div className="persona-highlights">
              {personaCard?.topStrengths?.slice(0, 3).map((strength, index) => (
                <span key={index} className="highlight-tag">{strength}</span>
              ))}
            </div>
          </div>
          
          <div className="customization-form">
            <h3>Customize Your Resume</h3>
            
            <div className="form-group">
              <label>Target Role</label>
              <input
                type="text"
                placeholder="e.g., Senior Software Engineer, Technical Lead"
                value={customizations.targetRole}
                onChange={(e) => handleCustomizationChange('targetRole', e.target.value)}
              />
            </div>
            
            <div className="form-group">
              <label>Experience Level</label>
              <select
                value={customizations.experience}
                onChange={(e) => handleCustomizationChange('experience', e.target.value)}
              >
                <option value="entry-level">Entry Level (0-2 years)</option>
                <option value="mid-level">Mid Level (3-5 years)</option>
                <option value="senior-level">Senior Level (6+ years)</option>
                <option value="executive">Executive/Leadership</option>
              </select>
            </div>
          </div>
          
          <div className="template-selection">
            <h3>Choose Template</h3>
            <div className="templates-grid">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`template-card ${selectedTemplate === template.id ? 'selected' : ''}`}
                  onClick={() => setSelectedTemplate(template.id)}
                >
                  <div className="template-preview">
                    <div className="preview-placeholder">
                      {template.name}
                    </div>
                  </div>
                  <h4>{template.name}</h4>
                  <p>{template.description}</p>
                </div>
              ))}
            </div>
          </div>
          
          <div className="generation-section">
            <div className="ai-features">
              <h4>AI-Powered Features</h4>
              <ul>
                <li>✨ Persona-optimized content</li>
                <li>🎯 Role-specific keywords</li>
                <li>📊 ATS-friendly formatting</li>
                <li>💡 Achievement quantification</li>
                <li>🔄 Multiple format exports</li>
              </ul>
            </div>
            
            <button
              className="generate-btn"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <div className="loading-spinner"></div>
                  Generating Your Resume...
                </>
              ) : (
                <>
                  🚀 Generate Resume
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResumeGenerator;
