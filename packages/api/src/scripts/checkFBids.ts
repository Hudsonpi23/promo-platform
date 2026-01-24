import 'dotenv/config';
import axios from 'axios';

const PAGE_1_TOKEN = 'EAAN6z9wxpSkBQsfuLhU7kGZAGcpwaZAauUbwaQwn9RXrkjIJsKN5PgVitZCKQY60DK0k8RK1YUmVFJoOZCiedKSuZASYG8NWjDcgmFYprZARkZAVnaf0VRh2lArNlCAczLw3vscgejZAlf1wUPEXn4a1zgAcrZA0n4nERl3vJTumlo2uCYLGA8tKhxRgZCW4ma22ONP2d3';
const PAGE_2_TOKEN = 'EAAN6z9wxpSkBQlmIzbFbXmZCfUVHiwOeCBlq69NTvRhBU6arQxQeK4AKv9G9iXTfkC975SrVOjKC4DlfxOs5mkMbzbZBiWuhZBP2oQdBxbtr3gIxgF6HyG2HQczzFe5TO5SeU2KZBjVN6ub8prdwY4OZBo4aQe7sdUSQffxQmuvu98u3aLwHG8n2EpHPuFwXpwEF5';

async function getPageInfo(token: string, name: string) {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v24.0/me?fields=id,name&access_token=${token}`
    );
    console.log(`${name}:`);
    console.log(`  ID: ${response.data.id}`);
    console.log(`  Nome: ${response.data.name}`);
    return response.data.id;
  } catch (error: any) {
    console.log(`${name} Erro:`, error.response?.data?.error?.message || error.message);
    return null;
  }
}

async function run() {
  console.log('\nVerificando IDs das paginas...\n');
  
  const id1 = await getPageInfo(PAGE_1_TOKEN, 'Token 1');
  const id2 = await getPageInfo(PAGE_2_TOKEN, 'Token 2');
  
  console.log('\n--- IDs corretos ---');
  console.log('Token 1 ID:', id1);
  console.log('Token 2 ID:', id2);
}

run();
