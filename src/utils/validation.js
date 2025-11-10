/**
 * Validation utilities for user input
 */

/**
 * Email validation regex
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Username validation regex (alphanumeric, underscore, dash, 3-50 chars)
 */
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,50}$/;

/**
 * Password validation regex (min 8 chars, at least one letter, one number)
 */
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;

/**
 * Phone validation regex (flexible format)
 */
const PHONE_REGEX = /^\+?[\d\s\-\(\)\.]{10,}$/;

/**
 * Name validation regex (letters, spaces, apostrophes, hyphens)
 */
const NAME_REGEX = /^[a-zA-Z\s\-\'\.]{2,100}$/;

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Whether email is valid
 */
function isValidEmail(email) {
    return typeof email === 'string' && EMAIL_REGEX.test(email.trim());
}

/**
 * Validate username format
 * @param {string} username - Username to validate
 * @returns {boolean} Whether username is valid
 */
function isValidUsername(username) {
    return typeof username === 'string' && USERNAME_REGEX.test(username.trim());
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with isValid and errors
 */
function validatePassword(password) {
    const errors = [];
    
    if (!password || typeof password !== 'string') {
        errors.push('Password is required');
        return { isValid: false, errors };
    }
    
    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Za-z]/.test(password)) {
        errors.push('Password must contain at least one letter');
    }
    
    if (!/\d/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    
    if (password.length > 128) {
        errors.push('Password must be less than 128 characters');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} Whether phone is valid
 */
function isValidPhone(phone) {
    if (!phone) return true; // Phone is optional
    return typeof phone === 'string' && PHONE_REGEX.test(phone.trim());
}

/**
 * Validate name format (first name, last name)
 * @param {string} name - Name to validate
 * @returns {boolean} Whether name is valid
 */
function isValidName(name) {
    return typeof name === 'string' && NAME_REGEX.test(name.trim());
}

/**
 * Validate user registration data
 * @param {Object} userData - User data to validate
 * @returns {Object} Validation result
 */
function validateUserRegistration(userData) {
    const errors = [];
    
    // Required fields
    if (!userData.username || !userData.username.trim()) {
        errors.push('Username is required');
    } else if (!isValidUsername(userData.username)) {
        errors.push('Username must be 3-50 characters long and contain only letters, numbers, underscores, and hyphens');
    }
    
    if (!userData.email || !userData.email.trim()) {
        errors.push('Email is required');
    } else if (!isValidEmail(userData.email)) {
        errors.push('Email format is invalid');
    }
    
    if (!userData.first_name || !userData.first_name.trim()) {
        errors.push('First name is required');
    } else if (!isValidName(userData.first_name)) {
        errors.push('First name format is invalid');
    }
    
    if (!userData.last_name || !userData.last_name.trim()) {
        errors.push('Last name is required');
    } else if (!isValidName(userData.last_name)) {
        errors.push('Last name format is invalid');
    }
    
    // Password validation
    if (!userData.password) {
        errors.push('Password is required');
    } else {
        const passwordValidation = validatePassword(userData.password);
        if (!passwordValidation.isValid) {
            errors.push(...passwordValidation.errors);
        }
    }
    
    // Optional fields
    if (userData.phone && !isValidPhone(userData.phone)) {
        errors.push('Phone number format is invalid');
    }
    
    if (userData.company && typeof userData.company !== 'string') {
        errors.push('Company must be a string');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validate user update data
 * @param {Object} userData - User data to validate
 * @returns {Object} Validation result
 */
function validateUserUpdate(userData) {
    const errors = [];
    
    // Only validate provided fields
    if (userData.username !== undefined) {
        if (!userData.username || !userData.username.trim()) {
            errors.push('Username cannot be empty');
        } else if (!isValidUsername(userData.username)) {
            errors.push('Username must be 3-50 characters long and contain only letters, numbers, underscores, and hyphens');
        }
    }
    
    if (userData.email !== undefined) {
        if (!userData.email || !userData.email.trim()) {
            errors.push('Email cannot be empty');
        } else if (!isValidEmail(userData.email)) {
            errors.push('Email format is invalid');
        }
    }
    
    if (userData.first_name !== undefined) {
        if (!userData.first_name || !userData.first_name.trim()) {
            errors.push('First name cannot be empty');
        } else if (!isValidName(userData.first_name)) {
            errors.push('First name format is invalid');
        }
    }
    
    if (userData.last_name !== undefined) {
        if (!userData.last_name || !userData.last_name.trim()) {
            errors.push('Last name cannot be empty');
        } else if (!isValidName(userData.last_name)) {
            errors.push('Last name format is invalid');
        }
    }
    
    if (userData.phone !== undefined && userData.phone && !isValidPhone(userData.phone)) {
        errors.push('Phone number format is invalid');
    }
    
    if (userData.company !== undefined && userData.company && typeof userData.company !== 'string') {
        errors.push('Company must be a string');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validate login data
 * @param {Object} loginData - Login data to validate
 * @returns {Object} Validation result
 */
function validateLogin(loginData) {
    const errors = [];
    
    if (!loginData.identifier || !loginData.identifier.trim()) {
        errors.push('Username or email is required');
    }
    
    if (!loginData.password || !loginData.password.trim()) {
        errors.push('Password is required');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validate role data
 * @param {Object} roleData - Role data to validate
 * @returns {Object} Validation result
 */
function validateRole(roleData) {
    const errors = [];
    
    if (!roleData.name || !roleData.name.trim()) {
        errors.push('Role name is required');
    } else if (roleData.name.length < 2 || roleData.name.length > 50) {
        errors.push('Role name must be between 2 and 50 characters');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(roleData.name)) {
        errors.push('Role name can only contain letters, numbers, underscores, and hyphens');
    }
    
    if (roleData.description && typeof roleData.description !== 'string') {
        errors.push('Description must be a string');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validate showroom data
 * @param {Object} showroomData - Showroom data to validate
 * @returns {Object} Validation result
 */
function validateShowroom(showroomData) {
    const errors = [];
    
    if (!showroomData.name || !showroomData.name.trim()) {
        errors.push('Showroom name is required');
    } else if (showroomData.name.length < 2 || showroomData.name.length > 255) {
        errors.push('Showroom name must be between 2 and 255 characters');
    }
    
    if (!showroomData.abbreviation || !showroomData.abbreviation.trim()) {
        errors.push('Showroom abbreviation is required');
    } else if (showroomData.abbreviation.length < 2 || showroomData.abbreviation.length > 10) {
        errors.push('Showroom abbreviation must be between 2 and 10 characters');
    } else if (!/^[A-Z0-9]+$/.test(showroomData.abbreviation)) {
        errors.push('Showroom abbreviation can only contain uppercase letters and numbers');
    }
    
    if (showroomData.email && !isValidEmail(showroomData.email)) {
        errors.push('Email format is invalid');
    }
    
    if (showroomData.phone && !isValidPhone(showroomData.phone)) {
        errors.push('Phone number format is invalid');
    }
    
    if (showroomData.zip && !/^\d{5}(-\d{4})?$/.test(showroomData.zip)) {
        errors.push('ZIP code format is invalid');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Sanitize string input
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeString(input) {
    if (typeof input !== 'string') return '';
    return input.trim().replace(/[<>]/g, '');
}

/**
 * Validate and sanitize user input
 * @param {Object} data - Data to validate and sanitize
 * @param {Array} requiredFields - Required field names
 * @returns {Object} Validation result with sanitized data
 */
function validateAndSanitize(data, requiredFields = []) {
    const errors = [];
    const sanitized = {};
    
    // Check required fields
    requiredFields.forEach(field => {
        if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
            errors.push(`${field} is required`);
        }
    });
    
    // Sanitize all string fields
    Object.keys(data).forEach(key => {
        if (typeof data[key] === 'string') {
            sanitized[key] = sanitizeString(data[key]);
        } else {
            sanitized[key] = data[key];
        }
    });
    
    return {
        isValid: errors.length === 0,
        errors,
        data: sanitized
    };
}

module.exports = {
    isValidEmail,
    isValidUsername,
    validatePassword,
    isValidPhone,
    isValidName,
    validateUserRegistration,
    validateUserUpdate,
    validateLogin,
    validateRole,
    validateShowroom,
    sanitizeString,
    validateAndSanitize
}; 