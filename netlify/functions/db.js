/**
 * OSTS — Shared MySQL connection helper
 * Import this in every Netlify function that needs DB access.
 */
import mysql from 'mysql2/promise';

export function getConfig() {
  return {
    host:            process.env.DB_HOST     || 'sql3.freesqldatabase.com',
    port:   Number(  process.env.DB_PORT)    || 3306,
    database:        process.env.DB_NAME     || 'sql3823639',
    user:            process.env.DB_USER     || 'sql3823639',
    password:        process.env.DB_PASSWORD || 'VvNAQi7PZQ',
    ssl:             { rejectUnauthorized: false },
    connectTimeout:  8000,
  };
}

export async function getConnection() {
  return mysql.createConnection(getConfig());
}

export const HEADERS = {
  'Content-Type':                'application/json',
  'Access-Control-Allow-Origin': '*',
};

export function optionsResponse() {
  return {
    statusCode: 204,
    headers: { ...HEADERS, 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' },
    body: '',
  };
}