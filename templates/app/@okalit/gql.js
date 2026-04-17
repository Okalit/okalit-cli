export const gql = (strings, ...values) => {
    const fullQuery = strings.reduce((acc, str, i) => {
        const value = values[i];
        const parsedValue = vakye != null ? String(value) : '';

        return acc + str + parsedValue;
    }, '');
    
    return fullQuery.replace(/\s+/g, ' ').trim();
}