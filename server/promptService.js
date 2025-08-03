import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import logger, { logTemplateUsage } from './logger.js';

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
      const template = templateCache.get(templateName);
      logTemplateUsage(null, templateName, template.version);
      return template;
    }
    
    const templatePath = path.join(PROMPTS_DIR, `${templateName}.yaml`);
    const templateContent = await fs.readFile(templatePath, 'utf8');
    const template = yaml.load(templateContent);
    
    // Cache the template
    templateCache.set(templateName, template);
    
    logger.info('Template loaded', {
      templateName,
      version: template.version,
      type: 'template_load'
    });
    
    return template;
    
  } catch (error) {
    logger.error('Failed to load template', {
      templateName,
      error: error.message,
      type: 'template_error'
    });
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

/**
 * Save template with version history
 */
export async function saveTemplateVersion(templateName, templateContent, metadata = {}) {
  try {
    // Ensure version history directory exists
    await fs.mkdir(VERSION_HISTORY_DIR, { recursive: true });
    
    // Parse the new template to get version
    const newTemplate = yaml.load(templateContent);
    const version = newTemplate.version || '1.0';
    
    // Load current template to backup
    let currentTemplate = null;
    try {
      currentTemplate = await loadPromptTemplate(templateName);
    } catch (error) {
      // Template doesn't exist yet, that's ok
    }
    
    // Save current version to history if it exists
    if (currentTemplate) {
      const timestamp = new Date().toISOString();
      const historyFileName = `${templateName}_v${currentTemplate.version}_${timestamp.replace(/[:.]/g, '-')}.yaml`;
      const historyPath = path.join(VERSION_HISTORY_DIR, historyFileName);
      
      await fs.writeFile(historyPath, yaml.dump(currentTemplate), 'utf8');
      
      // Update version history tracking
      if (!versionHistory.has(templateName)) {
        versionHistory.set(templateName, []);
      }
      versionHistory.get(templateName).push({
        version: currentTemplate.version,
        timestamp,
        fileName: historyFileName,
        metadata: { ...metadata, action: 'backup' }
      });
    }
    
    // Save new template
    await updateTemplate(templateName, templateContent);
    
    // Record new version in history
    if (!versionHistory.has(templateName)) {
      versionHistory.set(templateName, []);
    }
    versionHistory.get(templateName).push({
      version,
      timestamp: new Date().toISOString(),
      fileName: `${templateName}.yaml`,
      metadata: { ...metadata, action: 'update' }
    });
    
    console.log(`✓ Template ${templateName} updated to version ${version}`);
    return { version, templateName, success: true };
    
  } catch (error) {
    console.error(`❌ Failed to save template version ${templateName}:`, error.message);
    throw error;
  }
}

/**
 * Get version history for a template
 */
export async function getTemplateVersionHistory(templateName) {
  try {
    // Load from file system if not in memory
    if (!versionHistory.has(templateName)) {
      await loadVersionHistoryFromDisk(templateName);
    }
    
    return versionHistory.get(templateName) || [];
  } catch (error) {
    console.error(`Failed to get version history for ${templateName}:`, error.message);
    return [];
  }
}

/**
 * Rollback template to previous version
 */
export async function rollbackTemplate(templateName, targetVersion) {
  try {
    const history = await getTemplateVersionHistory(templateName);
    const targetEntry = history.find(entry => entry.version === targetVersion);
    
    if (!targetEntry) {
      throw new Error(`Version ${targetVersion} not found for template ${templateName}`);
    }
    
    // Load the target version
    let templateContent;
    if (targetEntry.fileName.startsWith(templateName + '_v')) {
      // It's a historical version
      const historyPath = path.join(VERSION_HISTORY_DIR, targetEntry.fileName);
      templateContent = await fs.readFile(historyPath, 'utf8');
    } else {
      // It's the current version
      const currentTemplate = await loadPromptTemplate(templateName);
      templateContent = yaml.dump(currentTemplate);
    }
    
    // Save as new version with rollback metadata
    await saveTemplateVersion(templateName, templateContent, {
      action: 'rollback',
      rolledBackFrom: await getCurrentTemplateVersion(templateName),
      rolledBackTo: targetVersion
    });
    
    console.log(`✓ Rolled back ${templateName} to version ${targetVersion}`);
    return { success: true, rolledBackTo: targetVersion };
    
  } catch (error) {
    console.error(`❌ Failed to rollback template ${templateName}:`, error.message);
    throw error;
  }
}

/**
 * Get current template version
 */
export async function getCurrentTemplateVersion(templateName) {
  try {
    const template = await loadPromptTemplate(templateName);
    return template.version || '1.0';
  } catch (error) {
    return null;
  }
}

/**
 * Load version history from disk
 */
async function loadVersionHistoryFromDisk(templateName) {
  try {
    const files = await fs.readdir(VERSION_HISTORY_DIR);
    const templateFiles = files.filter(file => file.startsWith(templateName + '_v'));
    
    const history = [];
    for (const file of templateFiles) {
      const filePath = path.join(VERSION_HISTORY_DIR, file);
      const stats = await fs.stat(filePath);
      
      // Extract version from filename
      const versionMatch = file.match(/_v([^_]+)_/);
      if (versionMatch) {
        history.push({
          version: versionMatch[1],
          timestamp: stats.mtime.toISOString(),
          fileName: file,
          metadata: { action: 'historical' }
        });
      }
    }
    
    // Add current version
    const currentVersion = await getCurrentTemplateVersion(templateName);
    if (currentVersion) {
      history.push({
        version: currentVersion,
        timestamp: new Date().toISOString(),
        fileName: `${templateName}.yaml`,
        metadata: { action: 'current' }
      });
    }
    
    // Sort by timestamp
    history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    versionHistory.set(templateName, history);
  } catch (error) {
    console.warn(`Could not load version history for ${templateName}:`, error.message);
  }
}
