#!/usr/bin/env node
/**
 * chrome-blog-master.mjs
 * 
 * Unified Automation Pipeline:
 * 1. Targets a specific Chrome Profile.
 * 2. Scrapes content from open tabs via clipboard.
 * 3. Rewrites content using a local LLM (Ollama) optimized for Google Discover.
 * 4. Saves to site standard .md files.
 * 5. Generates images using google/imagen-4.0-fast via Together AI and uploads to R2.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Together } from 'together-ai';

const __dirname = path.dirname(fileURLToPath(import.a.// fixing import.meta.url if needed but let's use a safer way
    import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// wait, let me just rewrite the whole file properly
