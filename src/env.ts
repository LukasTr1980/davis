import 'dotenv/config';

function must(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`Env ${name} missing`);
    return v;
}

export const API_KEY = must('API_KEY');
export const API_SECRET = must('API_SECRET');
