const baseUrls = {
    users: 'https://nocodb-production-fc9f.up.railway.app/api/v2/tables/mgb2oyswnowx1zd/records',
    userProjects: 'https://nocodb-production-fc9f.up.railway.app/api/v2/tables/mioix65cygxjway/links/c9d1etbtwagiemf/records',
    projects: 'https://nocodb-production-fc9f.up.railway.app/api/v2/tables/mioix65cygxjway/records',
    tokenCounts: 'https://nocodb-production-fc9f.up.railway.app/api/v2/tables/mg506jpu9lldx26/records/count'
};

const token = 'FCql2pK4TLKHAZ-Qv9UtfTt-Bv4EOsJfr38nNEW2';

async function fetchData(url) {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'xc-token': token
            }
        });
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('There has been a problem with your fetch operation:', error);
    }
}

async function fetchUsers() {
    return await fetchData(baseUrls.users);
}

async function fetchUserById(userId) {
    const url = `${baseUrls.users}/${userId}`;
    return await fetchData(url);
}

async function fetchTokenCounts(projectId, userId, daysAgo) {
    const whereParam = encodeURIComponent(`(Projects,eq,${projectId})~and(Users,eq,${userId})~and(start,eq,daysAgo,${daysAgo})`);
    const url = `${baseUrls.tokenCounts}?where=${whereParam}`;
    return await fetchData(url);
}

async function fetchTokenCountsByDate(userId, daysAgo) {
    const whereParam = encodeURIComponent(`(Users,eq,${userId})~and(start,eq,daysAgo,${daysAgo})`);
    const url = `${baseUrls.tokenCounts}?where=${whereParam}`;
    const data = await fetchData(url);
    console.log('Token counts data:', data); // Log the fetched data for debugging
    return data;
}

async function fetchDetailedTokenCountsByDate(userId, daysAgo) {
    const whereParam = encodeURIComponent(`(Users,eq,${userId})~and(start,eq,daysAgo,${daysAgo})`);
    const url = `${baseUrls.tokenCounts.replace('/count', '')}?where=${whereParam}`;
    const data = await fetchData(url);

    //console.log('Fetched token counts data:', data); // Log the fetched data for debugging

    // Ensure data.list is defined and is an array
    if (!data || !Array.isArray(data.list)) {
        console.error('Invalid data format:', data);
        return {
            Ontime: 0,
            Late: 0,
            Pto: 0
        };
    }

    // Count Ontime, Late, and Pto tokens
    const tokenCounts = {
        Ontime: 0,
        Late: 0,
        Pto: 0
    };

    data.list.forEach(token => {
        if (token.TokenType === 'Ontime') {
            tokenCounts.Ontime += 1;
        } else if (token.TokenType === 'Late') {
            tokenCounts.Late += 1;
        } else if (token.TokenType === 'Pto') {
            tokenCounts.Pto += 1;
        }
    });

    return tokenCounts;
}

