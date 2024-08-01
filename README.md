**Documentation for the front end**

Tech Stack:

```
Next.js
```

_[Node](https://nodejs.org/en/download) has to be installed on the machine!!!_
To make sure it is installed, run both commands one after another:

```
node -v
npm -v
```

Both need to show their installed versions to make sure they are working properly

1. Clone GitHub [repo](https://github.com/eduard0497/new_wbm_front.git)
2. Open terminal (or GitBash) in the folder directory
3. Run command:

```
npm i
```

4. Create a file called _.env.local_ in root directory of the folder
5. Add following environmental variables to that file:

```
NEXT_PUBLIC_GOOGLE_MAP_API_KEY={Obtain API key from Google Map Javascript SDK}
SECRET_TOKEN={random string that is used with devices to send data}
ADMIN_TOKEN={random string}

#switch from supabase DB or local db (true for local)
NEXT_PUBLIC_USE_LOCAL={true or false}

# Supabase environment variables
NEXT_PUBLIC_SUPABASE_URL={obtain from Supabase database under settings}
NEXT_PUBLIC_SUPABASE_ANON_KEY={obtain from Supabase database under settings}
SUPABASE_SERVICE_ROLE_KEY={obtain from Supabase database under settings}


```

6. Start up the front end by running the following command:

```
npm run dev
```

If no errors occured, the front end should start automatically at link **_http://localhost:3001/_**
