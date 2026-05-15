**Documentation for the machine learning and dashboard**

Tech Stack:

```
Dashboard -> Next.js
Database  -> Supabase PostgreSQL
ML Models -> Logistic Regression and Gaussian Naive Bayes
Runtime   -> Node.js
```

# What This Part Does

The machine learning system predicts whether each smart bin is likely to become
urgent in the next 6 hours.

Urgent means:

```
future fill level >= 92%
OR
future smell risk >= 600
```

The system uses a sliding window:

```
previous/current 6 hours -> model features X
next 6 hours             -> training label y
```

During live prediction, the future 6 hours do not exist yet. The trained model
uses the current bin state and the previous 6 hours to estimate that future risk.

# Important Project Files

```
app/api/priority-train/route.js       -> trains Logistic Regression
app/api/priority-train-nb/route.js    -> trains Naive Bayes
app/api/predict-priority/route.js     -> predicts/ranks bins with Logistic Regression
app/api/predict-priority-nb/route.js  -> predicts/ranks bins with Naive Bayes
lib/ml_logistic.js                    -> Logistic Regression code
lib/ml_naive_bayes.js                 -> Naive Bayes code
lib/features.js                       -> feature engineering code
window_comparison.mjs                 -> compares 6h, 10h, 12h, and 24h windows
```

You can move these files and create an ML folder if that makes the structure easier to organize.

# Dependencies

_[Node](https://nodejs.org/en/download) has to be installed on the machine!!!_
To check that Node and npm are installed, run:

```
node -v
npm -v
```

Both commands should print version numbers.

# Setup Steps

1. Clone or copy the project folder.
2. Open terminal in the frontend folder:

```
cd frontend/new-wbm-frkd
```

3. Install dependencies:

```
npm install
```

4. Create a file called `.env.local` in the root of `frontend/new-wbm-frkd`.

5. Add the required environment variables:

```
NEXT_PUBLIC_GOOGLE_MAP_API_KEY={Google Maps API key}
SECRET_TOKEN={secret used by device/backend routes}
ADMIN_TOKEN={admin token}

NEXT_PUBLIC_USE_LOCAL=false

NEXT_PUBLIC_SUPABASE_URL={Supabase project URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY={Supabase anon key}
SUPABASE_SERVICE_ROLE_KEY={Supabase service role key if needed}

TTN_WEBHOOK_SECRET={optional secret for TTN webhook validation}
```

# Running The Dashboard

Run:

```
npm run dev
```

Then open the local URL printed in the terminal. Usually it is one of:

```
http://localhost:3000
http://localhost:3001
```

Login with the dashboard credentials or admin token used by the project.

# Database Tables Used By Machine Learning

The machine learning routes mainly use these Supabase tables:

```
devices
historical
priority_weights
bin_priority_predictions
```

`devices`

```
Stores the current state of each bin.
Used during prediction to get current fill, gas, temp, humidity, and bin height.
```

`historical`

```
Stores all past sensor readings.
Used during training to build 6-hour sliding-window examples.
Used during prediction to build recent 6-hour live features.
```

`priority_weights`

```
Stores trained models.
For Logistic Regression, it stores weights, bias, feature list, mean, and std.
For Naive Bayes, it stores priors, means, and variances.
```

`bin_priority_predictions`

```
Stores prediction snapshots.
Includes final predicted priority, ML probability, fill level, fill rate, smell risk, and model used.
```

# Creating The Database Tables

Open the Supabase SQL
Editor and run this query. This uses only the columns shown in the current
Supabase schema.

<pre>

```sql
CREATE TABLE IF NOT EXISTS bin_priority_predictions (
  id SERIAL NOT NULL PRIMARY KEY,
  unique_id INTEGER NOT NULL,
  predicted_priority DOUBLE PRECISION NOT NULL,
  predicted_full_at TIMESTAMPTZ NULL,
  model_used VARCHAR NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  prob_pickup_in_thours DOUBLE PRECISION NULL,
  level_pct SMALLINT NULL,
  fill_rate DOUBLE PRECISION NULL,
  smell_risk DOUBLE PRECISION NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id SERIAL NOT NULL,
  unique_id INTEGER NOT NULL PRIMARY KEY,
  is_registered BOOLEAN NOT NULL,
  lat VARCHAR(100) NULL,
  lng VARCHAR(100) NULL,
  battery SMALLINT NULL,
  level DOUBLE PRECISION NULL,
  reception SMALLINT NULL,
  bin_height SMALLINT NULL,
  timestamp TIMESTAMPTZ NULL DEFAULT CURRENT_TIMESTAMP,
  temp DOUBLE PRECISION NULL,
  humidity DOUBLE PRECISION NULL,
  h2s DOUBLE PRECISION NULL,
  smoke DOUBLE PRECISION NULL,
  nh3 DOUBLE PRECISION NULL,
  bin_label TEXT NULL,
  bin_color TEXT NULL,
  waste_stream TEXT NULL
);

CREATE TABLE IF NOT EXISTS feedbacks (
  id SERIAL NOT NULL PRIMARY KEY,
  device_id VARCHAR NULL,
  reported_by_id SMALLINT NULL,
  reported_by_name VARCHAR NULL,
  title TEXT NULL,
  description TEXT NULL,
  assigned_to SMALLINT NULL,
  addressed BOOLEAN NOT NULL DEFAULT false,
  addressed_date TIMESTAMPTZ NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  devicetype VARCHAR NULL
);

CREATE TABLE IF NOT EXISTS historical (
  id SERIAL NOT NULL PRIMARY KEY,
  unique_id INTEGER NOT NULL,
  level_in_percents DOUBLE PRECISION NULL,
  saved_time TIMESTAMPTZ NULL DEFAULT CURRENT_TIMESTAMP,
  temp DOUBLE PRECISION NULL,
  humidity DOUBLE PRECISION NULL,
  h2s DOUBLE PRECISION NULL,
  smoke DOUBLE PRECISION NULL,
  nh3 DOUBLE PRECISION NULL
);

CREATE TABLE IF NOT EXISTS priority_weights (
  model VARCHAR NOT NULL,
  weights JSONB NOT NULL,
  bias DOUBLE PRECISION NOT NULL,
  meta JSONB NOT NULL,
  trained_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  train_accuracy DOUBLE PRECISION NULL,
  id BIGSERIAL NOT NULL PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS routes (
  id SERIAL NOT NULL PRIMARY KEY,
  employeeid INTEGER NULL,
  deviceids INTEGER[] NOT NULL,
  emptybin BOOLEAN NOT NULL,
  changebattery BOOLEAN NOT NULL,
  status VARCHAR NOT NULL,
  started TIMESTAMP NULL,
  finished TIMESTAMP NULL,
  timestamp TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL NOT NULL,
  fname VARCHAR NULL,
  lname VARCHAR NULL,
  email VARCHAR NOT NULL PRIMARY KEY,
  password VARCHAR NULL,
  role VARCHAR NULL,
  start_date DATE NULL
);

CREATE TABLE IF NOT EXISTS weather_sensors (
  id SERIAL NOT NULL,
  unique_id INTEGER NOT NULL PRIMARY KEY,
  is_registered BOOLEAN NOT NULL DEFAULT false,
  lat VARCHAR NULL,
  lng VARCHAR NULL,
  battery SMALLINT NULL,
  reception SMALLINT NULL,
  temp DOUBLE PRECISION NULL,
  humidity DOUBLE PRECISION NULL,
  timestamp TIMESTAMPTZ NULL DEFAULT CURRENT_TIMESTAMP
);
```

</pre>

After creating the tables, add at least one row in `devices` for each physical
bin. The important columns are:

```
unique_id       -> device ID from TTN / hardware
is_registered   -> must be true
bin_height      -> bin height in cm
level           -> current ultrasonic distance reading in cm
temp            -> current temperature
humidity        -> current humidity
h2s             -> current H2S reading
nh3             -> current NH3 reading
smoke           -> current smoke reading
```

The `historical` table must contain past rows for the same `unique_id`. Training
will not work with only current rows in `devices`; it needs enough timestamped
history in `historical` to build 6-hour lookback and 6-hour lookahead examples.

The full dashboard also uses these application tables:

```
users
feedbacks
routes
weather_sensors
```

Those tables are for login, feedback, collection routes, and weather sensor
features. The machine learning training and prediction routes mainly depend on
`devices`, `historical`, `priority_weights`, and `bin_priority_predictions`.

# How Training Works

Training builds examples from the `historical` table.

For each registered bin:

```
1. Read only that bin's historical rows.
2. Sort rows by saved_time.
3. Pick one row as reference time t.
4. Look back 6 hours to build features X.
5. Look ahead 6 hours to create label y.
6. Push X and y into the training dataset.
```

Example:

```
X = current fill, fill rate, temp, humidity, gas max values, time since empty, smell risk
y = 1 if the bin becomes urgent in the next 6 hours
y = 0 otherwise
```

The database can contain mixed device IDs, but the code groups rows by
`unique_id` before building windows. A 6-hour window never mixes two different
bins.

# Logistic Regression Model

Logistic Regression uses 9 features:

```
level_in_percents
fill_rate
temp
humidity
h2s_max_h
nh3_max_h
smoke_max_h
time_since_empty_h
smell_risk
```

Training settings:

```
alpha / learning rate = 0.05
epochs                = 2000
lambda                = 0.5
```

These are training settings. They are not the learned values.

The learned values are:

```
weights
bias
```

They are saved in:

```
priority_weights
```

# Naive Bayes Model

Naive Bayes uses 8 features:

```
level_in_percents
fill_rate
temp
humidity
h2s_max_h
nh3_max_h
smoke_max_h
time_since_empty_h
```

It does not use `smell_risk` as an input feature because `smell_risk` is already
made from gas, temperature, and humidity. Including it would double-count the
same evidence.

Naive Bayes still uses future `smellRisk >= 600` when creating the label `y`.

# How To Retrain Logistic Regression

Start the dashboard:

```
npm run dev
```

Then:

1. Open the dashboard.
2. Select Logistic Regression.
3. Enter a model name, for example:

```
pickup_in_6h_v2
```

4. Click `Train Model`.

You can also train from terminal:

```
curl -X POST http://localhost:3000/api/priority-train \
  -H "Content-Type: application/json" \
  -d '{"model_name":"pickup_in_6h_v2"}'
```

If your app is running on port 3001, replace `3000` with `3001`.

# How To Retrain Naive Bayes

Start the dashboard:

```
npm run dev
```

Then:

1. Open the dashboard.
2. Select Naive Bayes.
3. Enter a model name, for example:

```
pickup_in_6h_v2
```

4. Click `Train Model`.

You can also train from terminal:

```
curl -X POST http://localhost:3000/api/priority-train-nb \
  -H "Content-Type: application/json" \
  -d '{"model_name":"pickup_in_6h_v2"}'
```

The Naive Bayes route saves the model with `_nb` added to the model name.

Example:

```
pickup_in_6h_v2 -> pickup_in_6h_v2_nb
```

# How Prediction Works

Open the pickup priority list page in the dashboard.

When the page refreshes priorities:

```
Logistic Regression selected -> /api/predict-priority
Naive Bayes selected         -> /api/predict-priority-nb
```

The prediction route:

```
1. Loads the trained model from priority_weights.
2. Reads current registered bins from devices.
3. Reads recent history from historical.
4. Builds one live feature row for each bin.
5. Calculates ML probability.
6. Calculates final operational priority.
7. Sorts bins from highest to lowest priority.
8. Saves the result into bin_priority_predictions.
```

# Direct Prediction Commands

Logistic Regression:

```
curl -X POST http://localhost:3000/api/predict-priority \
  -H "Content-Type: application/json" \
  -d '{"model_name":"pickup_in_6h_v2"}'
```

Naive Bayes:

```
curl -X POST http://localhost:3000/api/predict-priority-nb \
  -H "Content-Type: application/json" \
  -d '{"model_name":"pickup_in_6h_v2"}'
```

# Probability vs Priority

`prob_pickup_in_T_hours`

```
This is the raw ML probability.
It means: how likely is this bin to become urgent in the next prediction window?
```

`predicted_priority`

```
This is the final operational priority score.
It is used to rank which bin should be collected first.
```

Final priority formula:

```
priority =
  0.5 * ML_probability
+ 0.3 * gasSeverity
+ 0.2 * fillSeverity
```

Safety overrides:

```
critical smoke     -> priority at least 0.95
two critical gases -> priority at least 0.90
critical fill      -> priority at least 0.85
```

# Window Comparison

To test different window sizes:

```
node window_comparison.mjs
```

This compares:

```
6h / 6h
10h / 10h
12h / 12h
24h / 24h
```

The 6-hour window was selected because longer windows made too many examples
positive and reduced true negative discrimination.

# Notes For Future Students

1. The system uses batch learning.
2. Each training run starts from scratch and retrains on available historical data.
3. Previously saved weights are used for prediction, but not for the next training run.
4. The model is global across all bins, but windows are created separately per bin.
5. Logistic Regression is the production model.
6. Naive Bayes is the comparison model.
7. Manual/tunable parameters include:

```
6-hour window
92% fill threshold
600 smell-risk threshold
0.5 / 0.3 / 0.2 final priority weights
alpha = 0.05
lambda = 0.5
epochs = 2000
```

Future work should tune these using more data, chronological validation, or
collector-confirmed pickup feedback.

_If reached here, the setup for the machine learning and dashboard pipeline is done._
