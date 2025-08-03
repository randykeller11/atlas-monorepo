import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROMPTS_DIR = path.join(__dirname, 'prompts');
const VERSION_HISTORY_DIR = path.join(PROMPTS_DIR, '.versions');

// In-memory cache for loaded templates
const templateCache = new Map();

// Add version history tracking
const versionHistory = new Map();

/**
 * Load and parse a prompt template
 */
export async function loadPromptTemplate(templateName) {
  try {
    // Check cache first
    if (templateCache.has(templateName)) {
      return templateCache.get(templateName);
    }
    
    const templatePath = path.join(PROMPTS_DIR, `${templateName}.yaml`);
    const templateContent = await fs.readFile(templatePath, 'utf8');
    const template = yaml.load(templateContent);
    
    // Cache the template
    templateCache.set(templateName, template);
    
    console.log(`✓ Loaded prompt template: ${templateName} v${template.version}`);
    return template;
    
  } catch (error) {
    console.error(`❌ Failed to load prompt template ${templateName}:`, error.message);
    throw new Error(`Template ${templateName} not found or invalid`);
  }
}

/**
 * Interpolate template with provided variables
 */
export function interpolateTemplate(template, variables = {}) {
  let content = template.template;
  
  // Simple Handlebars-style interpolation
  // Replace {{variable}} with values
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    content = content.replace(regex, value || '');
  });
  
  // Handle conditional blocks {{#if variable}}...{{/if}}
  content = content.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, varName, block) => {
    return variables[varName] ? block : '';
  });
  
  // Clean up any remaining template syntax
  content = content.replace(/{{.*?}}/g, '');
  
  return content.trim();
}

/**
 * Get all available templates
 */
export async function getAvailableTemplates() {
  try {
    const files = await fs.readdir(PROMPTS_DIR);
    const yamlFiles = files.filter(file => file.endsWith('.yaml'));
    
    const templates = [];
    for (const file of yamlFiles) {
      try {
        const templateName = path.basename(file, '.yaml');
        const template = await loadPromptTemplate(templateName);
        templates.push({
          name: templateName,
          version: template.version,
          description: template.name
        });
      } catch (error) {
        console.warn(`Skipping invalid template ${file}:`, error.message);
      }
    }
    
    return templates;
  } catch (error) {
    console.error('Failed to get available templates:', error.message);
    return [];
  }
}

/**
 * Clear template cache (useful for development)
 */
export function clearTemplateCache() {
  templateCache.clear();
  console.log('✓ Template cache cleared');
}

/**
 * Update a template (for admin interface)
 */
export async function updateTemplate(templateName, templateContent) {
  try {
    const templatePath = path.join(PROMPTS_DIR, `${templateName}.yaml`);
    await fs.writeFile(templatePath, templateContent, 'utf8');
    
    // Clear from cache to force reload
    templateCache.delete(templateName);
    
    console.log(`✓ Updated template: ${templateName}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to update template ${templateName}:`, error.message);
    throw error;
  }
}
